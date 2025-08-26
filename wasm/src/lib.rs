use wasm_bindgen::prelude::*;
use js_sys::Float64Array;

#[inline]
fn rand_f64() -> f64 { js_sys::Math::random() }

// Standard normal via Box-Muller
fn rand_std_normal() -> f64 {
    let mut u1 = rand_f64();
    let mut u2 = rand_f64();
    // Avoid log(0)
    if u1 <= 1e-12 { u1 = 1e-12; }
    if u2 <= 1e-12 { u2 = 1e-12; }
    ( -2.0 * u1.ln() ).sqrt() * ( 2.0 * std::f64::consts::PI * u2 ).cos()
}

// Poisson sampler (Knuth) for small lambda
fn sample_poisson(lambda: f64) -> i64 {
    if lambda <= 0.0 { return 0; }
    let l = (-lambda).exp();
    let mut k: i64 = 0;
    let mut p = 1.0;
    loop {
        k += 1;
        p *= rand_f64();
        if p <= l { break; }
    }
    (k - 1) as i64
}

fn sample_binomial(n: i64, mut p: f64) -> i64 {
    if n <= 0 { return 0; }
    if p <= 0.0 { return 0; }
    if p >= 1.0 { return n; }
    // Use symmetry to keep p <= 0.5
    let mutate = p > 0.5;
    if mutate { p = 1.0 - p; }

    let nn = n as f64;
    let mean = nn * p;
    let var = mean * (1.0 - p);

    let k = if n < 50 {
        // Direct Bernoulli sum for small n
        let mut c = 0i64;
        for _ in 0..n { if rand_f64() < p { c += 1; } }
        c
    } else if mean < 30.0 {
        // Poisson approximation with lambda = n*p
        let mut k = sample_poisson(mean);
        if k > n { k = n; }
        k
    } else {
        // Normal approximation
        let z = rand_std_normal();
        let mut k = (mean + z * var.sqrt()).round() as i64;
        if k < 0 { k = 0; }
        if k > n { k = n; }
        k
    };

    if mutate { n - k } else { k }
}

#[wasm_bindgen]
pub fn simulate_steps_final(
    mut e: f64,
    mut es: f64,
    mut ep: f64,
    mut s: f64,
    mut p: f64,
    mut tiempo: f64,
    _ns: f64,
    _np: f64,
    k1: f64,
    k_minus3: f64,
    k_minus1: f64,
    k2: f64,
    k_minus2: f64,
    k3: f64,
    dt: f64,
    steps: u32,
) -> Float64Array {
    for _ in 0..steps {
        // Ensure non-negative
        if e < 0.0 { e = 0.0; }
        if es < 0.0 { es = 0.0; }
        if ep < 0.0 { ep = 0.0; }
        if s < 0.0 { s = 0.0; }
        if p < 0.0 { p = 0.0; }

        // Compute NEL/NES/NEP as rounded current counts (like TS engine)
        let nel = e.round().max(0.0) as i64;
        let nes_c = es.round().max(0.0) as i64;
        let nep_c = ep.round().max(0.0) as i64;

        // ---------- Competing-risks aggregated transitions for free E ----------
        // Rates per molecule
        let lambda1 = (k1 * s.max(0.0)).max(0.0);
        let lambda2 = (k_minus3 * p.max(0.0)).max(0.0);
        let lambda_sum = lambda1 + lambda2;
        let dt_clamped = if dt.is_finite() && dt > 0.0 { dt } else { 1.0 };
        let p_tot = if lambda_sum > 0.0 { 1.0 - (-(lambda_sum * dt_clamped)).exp() } else { 0.0 };
        let n_react = sample_binomial(nel, p_tot);
        let frac1 = if lambda_sum > 0.0 { (lambda1 / lambda_sum).clamp(0.0, 1.0) } else { 0.0 };
        let n_es_raw = sample_binomial(n_react, frac1);
        let n_ep_raw = n_react - n_es_raw;
        // Cap by resources with overflow reassignment between channels
        let s_avail = s.floor().max(0.0) as i64;
        let p_avail = p.floor().max(0.0) as i64;
        let mut n_es = n_es_raw.min(s_avail);
        let mut n_ep = n_ep_raw.min(p_avail);
        let s_left = s_avail - n_es;
        let p_left = p_avail - n_ep;
        let overflow_es = n_es_raw - n_es; // ES wanted but no S
        let overflow_ep = n_ep_raw - n_ep; // EP wanted but no P
        if overflow_es > 0 && p_left > 0 {
            let add = overflow_es.min(p_left);
            n_ep += add;
        }
        if overflow_ep > 0 && s_left > 0 {
            let add = overflow_ep.min(s_left);
            n_es += add;
        }
        // Apply updates
        e -= (n_es + n_ep) as f64;
        es += n_es as f64;
        ep += n_ep as f64;
        s -= n_es as f64;
        p -= n_ep as f64;

        // ---------- Competing-risks for ES complexes ----------
        let lambda1_es = k_minus1.max(0.0);
        let lambda2_es = k2.max(0.0);
        let lambda_sum_es = lambda1_es + lambda2_es;
        let p_tot_es = if lambda_sum_es > 0.0 { 1.0 - (-(lambda_sum_es * dt_clamped)).exp() } else { 0.0 };
        let n_react_es = sample_binomial(nes_c, p_tot_es);
        let frac1_es = if lambda_sum_es > 0.0 { (lambda1_es / lambda_sum_es).clamp(0.0, 1.0) } else { 0.0 };
        let to_el = sample_binomial(n_react_es, frac1_es);
        let to_ep = n_react_es - to_el;

        e += to_el as f64;
        es -= (to_el + to_ep) as f64;
        s += to_el as f64;
        ep += to_ep as f64;

        // ---------- Competing-risks for EP complexes ----------
        let lambda1_ep = k_minus2.max(0.0);
        let lambda2_ep = k3.max(0.0);
        let lambda_sum_ep = lambda1_ep + lambda2_ep;
        let p_tot_ep = if lambda_sum_ep > 0.0 { 1.0 - (-(lambda_sum_ep * dt_clamped)).exp() } else { 0.0 };
        let n_react_ep = sample_binomial(nep_c, p_tot_ep);
        let frac1_ep = if lambda_sum_ep > 0.0 { (lambda1_ep / lambda_sum_ep).clamp(0.0, 1.0) } else { 0.0 };
        let to_es = sample_binomial(n_react_ep, frac1_ep);
        let to_e = n_react_ep - to_es;

        es += to_es as f64;
        ep -= (to_es + to_e) as f64;
        e += to_e as f64;
        p += to_e as f64;

        // Clamp
        if e < 0.0 { e = 0.0; }
        if es < 0.0 { es = 0.0; }
        if ep < 0.0 { ep = 0.0; }
        if s < 0.0 { s = 0.0; }
        if p < 0.0 { p = 0.0; }

        // Increment time by dt
        tiempo += dt_clamped;
    }

    let out = js_sys::Array::new_with_length(6);
    out.set(0, JsValue::from_f64(e));
    out.set(1, JsValue::from_f64(es));
    out.set(2, JsValue::from_f64(ep));
    out.set(3, JsValue::from_f64(s));
    out.set(4, JsValue::from_f64(p));
    out.set(5, JsValue::from_f64(tiempo));

    Float64Array::new(&out)
}

#[wasm_bindgen]
pub fn simulate_steps_series(
    mut e: f64,
    mut es: f64,
    mut ep: f64,
    mut s: f64,
    mut p: f64,
    mut tiempo: f64,
    _ns: f64,
    _np: f64,
    k1: f64,
    k_minus3: f64,
    k_minus1: f64,
    k2: f64,
    k_minus2: f64,
    k3: f64,
    dt: f64,
    steps: u32,
) -> Float64Array {
    let mut data: Vec<f64> = Vec::with_capacity(6 * steps as usize);
    let dt_clamped = if dt.is_finite() && dt > 0.0 { dt } else { 1.0 };

    for _ in 0..steps {
        // Ensure non-negative
        if e < 0.0 { e = 0.0; }
        if es < 0.0 { es = 0.0; }
        if ep < 0.0 { ep = 0.0; }
        if s < 0.0 { s = 0.0; }
        if p < 0.0 { p = 0.0; }

        // Compute NEL/NES/NEP as rounded current counts
        let nel = e.round().max(0.0) as i64;
        let nes_c = es.round().max(0.0) as i64;
        let nep_c = ep.round().max(0.0) as i64;

        // ---------- Competing-risks aggregated transitions for free E ----------
        let lambda1 = (k1 * s.max(0.0)).max(0.0);
        let lambda2 = (k_minus3 * p.max(0.0)).max(0.0);
        let lambda_sum = lambda1 + lambda2;
        let p_tot = if lambda_sum > 0.0 { 1.0 - (-(lambda_sum * dt_clamped)).exp() } else { 0.0 };
        let n_react = sample_binomial(nel, p_tot);
        let frac1 = if lambda_sum > 0.0 { (lambda1 / lambda_sum).clamp(0.0, 1.0) } else { 0.0 };
        let n_es_raw = sample_binomial(n_react, frac1);
        let n_ep_raw = n_react - n_es_raw;
        // Cap by resources with overflow reassignment between channels
        let s_avail = s.floor().max(0.0) as i64;
        let p_avail = p.floor().max(0.0) as i64;
        let mut n_es = n_es_raw.min(s_avail);
        let mut n_ep = n_ep_raw.min(p_avail);
        let s_left = s_avail - n_es;
        let p_left = p_avail - n_ep;
        let overflow_es = n_es_raw - n_es;
        let overflow_ep = n_ep_raw - n_ep;
        if overflow_es > 0 && p_left > 0 {
            let add = overflow_es.min(p_left);
            n_ep += add;
        }
        if overflow_ep > 0 && s_left > 0 {
            let add = overflow_ep.min(s_left);
            n_es += add;
        }
        e -= (n_es + n_ep) as f64;
        es += n_es as f64;
        ep += n_ep as f64;
        s -= n_es as f64;
        p -= n_ep as f64;

        // ---------- Competing-risks for ES complexes ----------
        let lambda1_es = k_minus1.max(0.0);
        let lambda2_es = k2.max(0.0);
        let lambda_sum_es = lambda1_es + lambda2_es;
        let p_tot_es = if lambda_sum_es > 0.0 { 1.0 - (-(lambda_sum_es * dt_clamped)).exp() } else { 0.0 };
        let n_react_es = sample_binomial(nes_c, p_tot_es);
        let frac1_es = if lambda_sum_es > 0.0 { (lambda1_es / lambda_sum_es).clamp(0.0, 1.0) } else { 0.0 };
        let to_el = sample_binomial(n_react_es, frac1_es);
        let to_ep = n_react_es - to_el;
        e += to_el as f64;
        es -= (to_el + to_ep) as f64;
        s += to_el as f64;
        ep += to_ep as f64;

        // ---------- Competing-risks for EP complexes ----------
        let lambda1_ep = k_minus2.max(0.0);
        let lambda2_ep = k3.max(0.0);
        let lambda_sum_ep = lambda1_ep + lambda2_ep;
        let p_tot_ep = if lambda_sum_ep > 0.0 { 1.0 - (-(lambda_sum_ep * dt_clamped)).exp() } else { 0.0 };
        let n_react_ep = sample_binomial(nep_c, p_tot_ep);
        let frac1_ep = if lambda_sum_ep > 0.0 { (lambda1_ep / lambda_sum_ep).clamp(0.0, 1.0) } else { 0.0 };
        let to_es = sample_binomial(n_react_ep, frac1_ep);
        let to_e = n_react_ep - to_es;
        es += to_es as f64;
        ep -= (to_es + to_e) as f64;
        e += to_e as f64;
        p += to_e as f64;

        // Clamp and time
        if e < 0.0 { e = 0.0; }
        if es < 0.0 { es = 0.0; }
        if ep < 0.0 { ep = 0.0; }
        if s < 0.0 { s = 0.0; }
        if p < 0.0 { p = 0.0; }
        tiempo += dt_clamped;

        // push series for this step
        data.push(e);
        data.push(es);
        data.push(ep);
        data.push(s);
        data.push(p);
        data.push(tiempo);
    }

    let arr = Float64Array::new_with_length(data.len() as u32);
    arr.copy_from(&data);
    arr
}

#[wasm_bindgen]
pub fn objective_sse(
    e0: f64,
    es0: f64,
    ep0: f64,
    s0: f64,
    p0: f64,
    t0: f64,
    ns: f64,
    np: f64,
    k1: f64,
    k_minus3: f64,
    k_minus1: f64,
    k2: f64,
    k_minus2: f64,
    k3: f64,
    dt: f64,
    times: &Float64Array,
    y_obs: &Float64Array,
    species_code: u32,
) -> f64 {
    let n = times.length() as usize;
    if n == 0 { return 0.0; }
    let n_obs = y_obs.length() as usize;
    let n_use = n.min(n_obs);
    if n_use == 0 { return 0.0; }

    let mut tt: Vec<f64> = vec![0.0; n_use];
    let mut yy: Vec<f64> = vec![0.0; n_use];
    times.slice(0, n_use as u32).copy_to(&mut tt);
    y_obs.slice(0, n_use as u32).copy_to(&mut yy);

    // Determine number of steps based on max time and dt
    let dt_clamped = if dt.is_finite() && dt > 0.0 { dt } else { 1.0 };
    let mut max_t = 0.0;
    for &x in &tt { if x.is_finite() && x > max_t { max_t = x; } }
    if max_t <= 0.0 { return 0.0; }
    let steps = ((max_t / dt_clamped).ceil() as i64).max(1) as u32;

    // Simulate series
    let series = simulate_steps_series(
        e0, es0, ep0, s0, p0, t0, ns, np,
        k1, k_minus3, k_minus1, k2, k_minus2, k3,
        dt_clamped, steps,
    );
    let data = series.to_vec();
    let m = (data.len() / 6) as usize;
    if m == 0 { return f64::NAN; }

    // Prepare time vector and species index accessor
    let mut t_series: Vec<f64> = Vec::with_capacity(m);
    for i in 0..m { t_series.push(data[6*i + 5]); }

    // Map species code to per-step index
    let sp_idx: usize = match species_code { // 0:S,1:P,2:E,3:ES,4:EP
        0 => 3,
        1 => 4,
        2 => 0,
        3 => 1,
        4 => 2,
        _ => 4, // default P
    };

    // Helper to get species value at step i
    let val_at = |i: usize| -> f64 { data[6*i + sp_idx] };

    // Interpolate for each target time
    let mut sse = 0.0;
    for i in 0..n_use {
        let tt_i = tt[i];
        if !tt_i.is_finite() { continue; }
        let mut y_pred;
        if tt_i <= t_series[0] {
            y_pred = val_at(0);
        } else if tt_i >= t_series[m-1] {
            y_pred = val_at(m-1);
        } else {
            // binary search for bracket
            let mut lo: usize = 0;
            let mut hi: usize = m - 1;
            while lo + 1 < hi {
                let mid = (lo + hi) / 2;
                if t_series[mid] <= tt_i { lo = mid; } else { hi = mid; }
            }
            let t0 = t_series[lo];
            let t1 = t_series[hi];
            let y0 = val_at(lo);
            let y1 = val_at(hi);
            let w = if t1 > t0 { (tt_i - t0) / (t1 - t0) } else { 0.0 };
            y_pred = y0 + w * (y1 - y0);
        }
        let e = yy[i] - y_pred;
        sse += e * e;
    }

    sse
}

fn sse_from_params(
    e0: f64, es0: f64, ep0: f64, s0: f64, p0: f64, t0: f64, ns: f64, np: f64,
    k1: f64, k_minus3: f64, k_minus1: f64, k2: f64, k_minus2: f64, k3: f64,
    dt: f64,
    times: &[f64], y_obs: &[f64], species_code: u32,
) -> f64 {
    let n_use = times.len().min(y_obs.len());
    if n_use == 0 { return 0.0; }
    let dt_clamped = if dt.is_finite() && dt > 0.0 { dt } else { 1.0 };
    let mut max_t = 0.0;
    for &x in times.iter().take(n_use) { if x.is_finite() && x > max_t { max_t = x; } }
    if max_t <= 0.0 { return 0.0; }
    let steps = ((max_t / dt_clamped).ceil() as i64).max(1) as u32;

    let series = simulate_steps_series(
        e0, es0, ep0, s0, p0, t0, ns, np,
        k1, k_minus3, k_minus1, k2, k_minus2, k3,
        dt_clamped, steps,
    );
    let data = series.to_vec();
    let m = (data.len() / 6) as usize;
    if m == 0 { return f64::NAN; }
    let mut t_series: Vec<f64> = Vec::with_capacity(m);
    for i in 0..m { t_series.push(data[6*i + 5]); }
    let sp_idx: usize = match species_code { 0 => 3, 1 => 4, 2 => 0, 3 => 1, 4 => 2, _ => 4 };
    let val_at = |i: usize| -> f64 { data[6*i + sp_idx] };
    let mut sse = 0.0;
    for i in 0..n_use {
        let tt_i = times[i];
        if !tt_i.is_finite() { continue; }
        let y_pred = if tt_i <= t_series[0] {
            val_at(0)
        } else if tt_i >= t_series[m-1] {
            val_at(m-1)
        } else {
            let mut lo: usize = 0; let mut hi: usize = m - 1;
            while lo + 1 < hi { let mid = (lo + hi) / 2; if t_series[mid] <= tt_i { lo = mid; } else { hi = mid; } }
            let t0b = t_series[lo]; let t1b = t_series[hi];
            let y0 = val_at(lo); let y1 = val_at(hi);
            let w = if t1b > t0b { (tt_i - t0b) / (t1b - t0b) } else { 0.0 };
            y0 + w * (y1 - y0)
        };
        let e = y_obs[i] - y_pred; sse += e * e;
    }
    sse
}

#[wasm_bindgen]
pub fn fit_nelder_mead(
    e0: f64, es0: f64, ep0: f64, s0: f64, p0: f64, t0: f64, ns: f64, np: f64,
    params_in: &Float64Array, // [k1,k-3,k-1,k2,k-2,k3,dt]
    mask: &js_sys::Uint8Array, // 1 => optimize, length 7
    times: &Float64Array,
    y_obs: &Float64Array,
    species_code: u32,
    max_iter: u32,
    tol: f64,
    scale: f64,
) -> Float64Array {
    let mut params = [0.0f64; 7];
    params_in.copy_to(&mut params);
    let mut mvec = vec![0u8; mask.length() as usize];
    mask.slice(0, 7).copy_to(&mut mvec[..]);
    let optimize_idx: Vec<usize> = (0..7).filter(|&i| mvec.get(i).copied().unwrap_or(0) != 0).collect();
    let n = optimize_idx.len();
    let t_vec = times.to_vec();
    let y_vec = y_obs.to_vec();
    if n == 0 {
        // Nothing to optimize, just return input and SSE
        let sse = sse_from_params(
            e0, es0, ep0, s0, p0, t0, ns, np,
            params[0], params[1], params[2], params[3], params[4], params[5], params[6],
            &t_vec, &y_vec, species_code,
        );
        let out = js_sys::Array::new_with_length(8);
        for i in 0..7 { out.set(i as u32, JsValue::from_f64(params[i])); }
        out.set(7, JsValue::from_f64(sse));
        return Float64Array::new(&out);
    }

    // Build initial simplex around current params in the subspace
    let mut x0: Vec<f64> = optimize_idx.iter().map(|&i| params[i]).collect();
    let mut simplex: Vec<Vec<f64>> = Vec::with_capacity(n + 1);
    simplex.push(x0.clone());
    let sc = if scale.is_finite() && scale > 0.0 { scale } else { 0.1 };
    for i in 0..n {
        let mut xi = x0.clone();
        let base = xi[i].abs();
        let delta = if base > 0.0 { base * sc } else { sc };
        xi[i] = xi[i] + delta;
        simplex.push(xi);
    }

    let mut fvals: Vec<f64> = vec![0.0; n + 1];
    let eval = |x: &Vec<f64>| -> f64 {
        // fill params with x at optimize_idx
        let mut trial = params;
        for (j, &idx) in optimize_idx.iter().enumerate() { trial[idx] = x[j].max(0.0); }
        let dtp = trial[6].max(1e-12);
        sse_from_params(
            e0, es0, ep0, s0, p0, t0, ns, np,
            trial[0], trial[1], trial[2], trial[3], trial[4], trial[5], dtp,
            &t_vec, &y_vec, species_code,
        )
    };
    for i in 0..(n + 1) { fvals[i] = eval(&simplex[i]); }

    // Nelder–Mead parameters
    let alpha = 1.0; // reflection
    let gamma = 2.0; // expansion
    let rho = 0.5; // contraction
    let sigma = 0.5; // shrink

    let mut iter = 0;
    while iter < max_iter {
        // Order simplex by f
        let mut idxs: Vec<usize> = (0..(n + 1)).collect();
        idxs.sort_by(|&a, &b| fvals[a].partial_cmp(&fvals[b]).unwrap_or(std::cmp::Ordering::Equal));
        simplex = idxs.iter().map(|&i| simplex[i].clone()).collect();
        fvals = idxs.iter().map(|&i| fvals[i]).collect();

        // Check convergence: stddev of fvals
        let mean = fvals.iter().sum::<f64>() / (n as f64 + 1.0);
        let var = fvals.iter().map(|v| (v - mean) * (v - mean)).sum::<f64>() / (n as f64 + 1.0);
        if var.sqrt() < tol { break; }

        // Centroid of all but worst
        let mut centroid = vec![0.0; n];
        for i in 0..n { for j in 0..n { centroid[j] += simplex[i][j]; } }
        for j in 0..n { centroid[j] /= n as f64; }

        // Reflection
        let mut xr = vec![0.0; n];
        for j in 0..n { xr[j] = centroid[j] + alpha * (centroid[j] - simplex[n][j]); }
        let fr = eval(&xr);
        if fr < fvals[0] {
            // Expansion
            let mut xe = vec![0.0; n];
            for j in 0..n { xe[j] = centroid[j] + gamma * (xr[j] - centroid[j]); }
            let fe = eval(&xe);
            if fe < fr { simplex[n] = xe; fvals[n] = fe; }
            else { simplex[n] = xr; fvals[n] = fr; }
        } else if fr < fvals[n - 1] {
            simplex[n] = xr; fvals[n] = fr;
        } else {
            // Contraction
            let mut xc = vec![0.0; n];
            for j in 0..n { xc[j] = centroid[j] + rho * (simplex[n][j] - centroid[j]); }
            let fc = eval(&xc);
            if fc < fvals[n] { simplex[n] = xc; fvals[n] = fc; }
            else {
                // Shrink
                for i in 1..(n + 1) {
                    for j in 0..n { simplex[i][j] = simplex[0][j] + sigma * (simplex[i][j] - simplex[0][j]); }
                    fvals[i] = eval(&simplex[i]);
                }
            }
        }
        iter += 1;
    }

    // Best point
    let best_x = &simplex[0];
    for (j, &idx) in optimize_idx.iter().enumerate() { params[idx] = best_x[j].max(0.0); }
    params[6] = params[6].max(1e-12);
    let best_sse = fvals[0];

    let out = js_sys::Array::new_with_length(8);
    for i in 0..7 { out.set(i as u32, JsValue::from_f64(params[i])); }
    out.set(7, JsValue::from_f64(best_sse));
    Float64Array::new(&out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    fn assert_finite_nonneg(v: f64) {
        assert!(v.is_finite(), "value is not finite: {}", v);
        assert!(v >= 0.0, "value is negative: {}", v);
    }

    #[wasm_bindgen_test]
    fn large_ep_simulate_steps_final() {
        // Initial conditions with very large EP
        let e0 = 10.0;
        let es0 = 0.0;
        let ep0 = 1_000_000.0;
        let s0 = 1_000_000.0;
        let p0 = 1_000_000.0;
        let t0 = 0.0;
        let ns = 0.0;
        let np = 0.0;
        // Moderate rates and dt
        let k1 = 1e-3;
        let k_minus3 = 1e-3;
        let k_minus1 = 1e-3;
        let k2 = 1e-3;
        let k_minus2 = 1e-3;
        let k3 = 1e-3;
        let dt = 0.01;
        let steps = 10u32;

        let total_e0 = e0 + es0 + ep0;
        let out = simulate_steps_final(
            e0, es0, ep0, s0, p0, t0, ns, np,
            k1, k_minus3, k_minus1, k2, k_minus2, k3,
            dt, steps,
        );
        let v = out.to_vec();
        assert_eq!(v.len(), 6);
        let (e, es, ep, s, p, t) = (v[0], v[1], v[2], v[3], v[4], v[5]);
        assert_finite_nonneg(e);
        assert_finite_nonneg(es);
        assert_finite_nonneg(ep);
        assert_finite_nonneg(s);
        assert_finite_nonneg(p);
        assert!(t.is_finite() && t > 0.0);
        // Mass conservation of E
        let total_e = e + es + ep;
        assert!((total_e - total_e0).abs() < 1e-6, "E mass not conserved: {} vs {}", total_e, total_e0);
    }

    #[wasm_bindgen_test]
    fn large_ep_simulate_steps_series() {
        let e0 = 10.0;
        let es0 = 0.0;
        let ep0 = 1_000_000.0;
        let s0 = 1_000_000.0;
        let p0 = 1_000_000.0;
        let t0 = 0.0;
        let ns = 0.0;
        let np = 0.0;
        let k1 = 5e-4;
        let k_minus3 = 5e-4;
        let k_minus1 = 5e-4;
        let k2 = 5e-4;
        let k_minus2 = 5e-4;
        let k3 = 5e-4;
        let dt = 0.02;
        let steps = 20u32;

        let total_e0 = e0 + es0 + ep0;
        let out = simulate_steps_series(
            e0, es0, ep0, s0, p0, t0, ns, np,
            k1, k_minus3, k_minus1, k2, k_minus2, k3,
            dt, steps,
        );
        let data = out.to_vec();
        assert_eq!(data.len(), (6 * steps as usize));
        for i in 0..steps as usize {
            let base = 6 * i;
            let e = data[base + 0];
            let es = data[base + 1];
            let ep = data[base + 2];
            let s = data[base + 3];
            let p = data[base + 4];
            let t = data[base + 5];
            assert_finite_nonneg(e);
            assert_finite_nonneg(es);
            assert_finite_nonneg(ep);
            assert_finite_nonneg(s);
            assert_finite_nonneg(p);
            let total_e = e + es + ep;
            assert!((total_e - total_e0).abs() < 1e-6, "E mass not conserved at step {}: {} vs {}", i+1, total_e, total_e0);
            let expected_t = dt * ((i as f64) + 1.0);
            assert!((t - expected_t).abs() < 1e-9, "time mismatch at step {}: got {}, expected {}", i+1, t, expected_t);
        }
    }
}
