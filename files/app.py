"""Exponential Reliability Lab - Flask backend.
Run locally:  python app.py   -> http://127.0.0.1:5000
Deploy:       gunicorn app:app
"""
import numpy as np
from flask import Flask, jsonify, render_template, request
from scipy import stats

app = Flask(__name__)


@app.route("/")
def home():
    return render_template("home.html")


@app.route("/analyze")
def page_analyze():
    return render_template("analyze.html")


@app.route("/predict")
def page_predict():
    return render_template("predict.html")


@app.route("/simulator")
def page_simulator():
    return render_template("simulator.html")


@app.route("/learn")
def page_learn():
    return render_template("learn.html")


@app.route("/api/analyze", methods=["POST"])
def analyze():
    body = request.get_json(force=True, silent=True) or {}
    try:
        x = np.array(body.get("data", []), dtype=float)
        conf = float(body.get("confidence", 0.95))
    except (TypeError, ValueError):
        return jsonify(error="Data must be a list of numbers."), 400

    x = x[np.isfinite(x)]
    if len(x) < 3 or (x <= 0).any():
        return jsonify(error="Enter at least 3 positive failure times."), 400
    if not 0.5 <= conf < 1:
        return jsonify(error="Confidence must be between 0.5 and 0.99."), 400

    n, mean = len(x), float(x.mean())
    lam = 1 / mean                                   # maximum-likelihood estimate
    a = 1 - conf
    lam_lo = stats.chi2.ppf(a / 2, 2 * n) / (2 * n * mean)      # exact chi-square CI
    lam_hi = stats.chi2.ppf(1 - a / 2, 2 * n) / (2 * n * mean)
    ks = stats.kstest(x, "expon", args=(0, mean))

    return jsonify(
        n=n, lam=lam, mttf=mean, median=float(np.log(2) / lam),
        lam_ci=[float(lam_lo), float(lam_hi)],
        mttf_ci=[float(1 / lam_hi), float(1 / lam_lo)],
        ks_stat=float(ks.statistic), ks_p=float(ks.pvalue), conf=conf,
    )


if __name__ == "__main__":
    app.run(debug=True)
