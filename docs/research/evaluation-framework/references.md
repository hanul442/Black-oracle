# Black Oracle Evaluation Framework — Reference Register

Status: Research baseline for Evaluation/Rating Engine v1

The references below are intentionally mixed across statistical finance, forecast verification, model-risk governance, tail-risk measurement, and rating surveillance. The Black Oracle rating labels are custom; no external credit-rating methodology is copied directly.

## Core references

1. S&P Global Ratings. **Understanding Credit Ratings**. Ratings scale, surveillance, rating transitions, and ordinal interpretation. https://www.spglobal.com/ratings/en/credit-ratings/about/understanding-credit-ratings

2. Board of Governors of the Federal Reserve System / OCC / FDIC. **Revised Guidance on Model Risk Management (SR 26-2)**, April 17, 2026. Model development, validation, monitoring, limitations, governance, and remediation. https://www.federalreserve.gov/supervisionreg/srletters/SR2602.htm

3. CFA Institute. **Portfolio Performance Evaluation**, 2026 curriculum. Benchmarking, attribution, Sortino ratio, maximum drawdown, drawdown duration, and manager-skill evaluation. https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/portfolio-performance-evaluation

4. Bailey, D. H. and López de Prado, M. **The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality**. Journal of Portfolio Management 40(5), 2014. DOI: 10.3905/jpm.2014.40.5.094

5. Bailey, D. H., Borwein, J. M., López de Prado, M., and Zhu, Q. J. **The Probability of Backtest Overfitting**. Journal of Computational Finance, 2017. DOI: 10.21314/JCF.2016.322

6. White, H. **A Reality Check for Data Snooping**. Econometrica 68(5), 2000, 1097–1126. DOI: 10.1111/1468-0262.00152

7. Hansen, P. R. **A Test for Superior Predictive Ability**. Journal of Business & Economic Statistics 23(4), 2005, 365–380. DOI: 10.1198/073500105000000063

8. Harvey, C. R., Liu, Y., and Zhu, H. **… and the Cross-Section of Expected Returns**. Review of Financial Studies 29(1), 2016, 5–68. DOI: 10.1093/rfs/hhv059

9. Diebold, F. X. and Mariano, R. S. **Comparing Predictive Accuracy**. Journal of Business & Economic Statistics 13(3), 1995, 253–263. DOI: 10.1080/07350015.1995.10524599

10. Gneiting, T. and Raftery, A. E. **Strictly Proper Scoring Rules, Prediction, and Estimation**. Journal of the American Statistical Association 102(477), 2007, 359–378. DOI: 10.1198/016214506000001437

11. Gneiting, T., Balabdaoui, F., and Raftery, A. E. **Probabilistic Forecasts, Calibration and Sharpness**. Journal of the Royal Statistical Society Series B 69(2), 2007, 243–268. DOI: 10.1111/j.1467-9868.2007.00587.x

12. Arrieta-Ibarra, I., Gujral, P., Tannen, J., Tygert, M., and Xu, C. **Metrics of Calibration for Probabilistic Predictions**. Journal of Machine Learning Research 23(351), 2022, 1–54. https://www.jmlr.org/papers/v23/22-0658.html

13. Acerbi, C. and Tasche, D. **Expected Shortfall: A Natural Coherent Alternative to Value at Risk**. Economic Notes 31(2), 2002, 379–388. DOI: 10.1111/1468-0300.00091

14. Basel Committee on Banking Supervision. **Basel Framework — MAR33 Internal Models Approach: Capital Requirements Calculation**. Expected-shortfall requirements and market-risk model framework. https://www.bis.org/committees/bcbs/basel-framework/standard/mar/33.htm

15. Sullivan, R., Timmermann, A., and White, H. **Data-Snooping, Technical Trading Rule Performance, and the Bootstrap**. Journal of Finance 54(5), 1999. DOI: 10.1111/0022-1082.00163

## Research rules derived from the register

- A strategy is never promoted solely because of its in-sample return or win rate.
- Searching many strategies creates a multiple-testing problem; the search count itself must be recorded and penalized.
- Forecast probabilities are evaluated as probabilities, not converted immediately into directional hit/miss labels.
- Risk assessment must include tail loss and drawdown behavior, not only volatility or average loss.
- Model quality is a lifecycle property: conceptual soundness, validation, ongoing monitoring, drift, limitations, and governance all matter.
- Ratings require surveillance and transition history; a current grade without its trajectory is incomplete.
- External rating nomenclature is used only as a familiar ordinal interface. Black Oracle scoring, gates, and promotion rules remain proprietary project policy.
