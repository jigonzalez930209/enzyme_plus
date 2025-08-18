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
