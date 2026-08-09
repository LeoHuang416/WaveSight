"""
Statistical Analysis Pipeline — Preprocessing → Hypothesis Testing → RSM & PCA
Usage: python statistical_analysis.py <path_to_csv>
"""
import sys
import warnings
import numpy as np
import pandas as pd
from scipy import stats
from scipy.stats import shapiro, levene, f_oneway, kruskal, pearsonr, spearmanr
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import statsmodels.api as sm
from statsmodels.formula.api import ols
from itertools import combinations

warnings.filterwarnings('ignore')
np.set_printoptions(suppress=True, precision=4)
pd.set_option('display.max_columns', None)
pd.set_option('display.width', 200)
pd.set_option('display.float_format', lambda x: f'{x:.4f}')


def phase1_preprocessing(df: pd.DataFrame, numeric_cols: list) -> tuple[pd.DataFrame, dict]:
    """Phase 1: Missing values, outlier detection, standardization. Returns (processed_df, report)."""
    report = {}
    df_proc = df.copy()

    # ── 1.1 Missing values ───────────────────────────────────────────
    missing = df_proc[numeric_cols].isnull().sum()
    missing_pct = (df_proc[numeric_cols].isnull().sum() / len(df_proc) * 100)
    missing_table = pd.DataFrame({'缺失数': missing, '缺失率(%)': missing_pct.round(2)})
    report['missing'] = missing_table

    for col in numeric_cols:
        pct = missing_pct[col]
        if 0 < pct < 5:
            median_val = df_proc[col].median()
            df_proc[col].fillna(median_val, inplace=True)
            print(f"  ↳ {col}: 缺失 {pct:.1f}% → 中位数插补 ({median_val:.4f})")
        elif pct >= 5:
            print(f"  ⚠ {col}: 缺失率 {pct:.1f}% ≥ 5%，请确认是否删除该列/样本")

    # ── 1.2 Outlier detection (IQR method) ───────────────────────────
    outlier_report = []
    for col in numeric_cols:
        col_data = df_proc[col].dropna().values
        if len(col_data) < 4:
            continue
        Q1, Q3 = np.percentile(col_data, [25, 75])
        IQR = Q3 - Q1
        lower, upper = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
        outlier_mask = (df_proc[col] < lower) | (df_proc[col] > upper)
        n_out = outlier_mask.sum()

        if n_out > 0:
            # Capping (Winsorize)
            capped_vals = df_proc[col].clip(lower, upper)
            for idx in df_proc.index[outlier_mask]:
                orig_val = df_proc.loc[idx, col]
                new_val = capped_vals.loc[idx]
                outlier_report.append({
                    '列': col, '样本索引': idx,
                    '原始值': round(orig_val, 4),
                    '处理后值': round(new_val, 4),
                    '方向': '上界' if orig_val > upper else '下界'
                })
            df_proc[col] = capped_vals
            print(f"  ↳ {col}: {n_out} 个异常值(IQR法) → 盖帽处理 [{lower:.3f}, {upper:.3f}]")
    report['outliers'] = pd.DataFrame(outlier_report) if outlier_report else pd.DataFrame(
        columns=['列', '样本索引', '原始值', '处理后值', '方向'])

    # ── 1.3 Z-score standardization ─────────────────────────────────
    scaler = StandardScaler()
    before_stats = df_proc[numeric_cols].agg(['mean', 'std']).T
    before_stats.columns = ['标准化前均值', '标准化前标准差']
    df_proc[numeric_cols] = scaler.fit_transform(df_proc[numeric_cols])
    after_stats = df_proc[numeric_cols].agg(['mean', 'std']).T
    after_stats.columns = ['标准化后均值', '标准化后标准差']
    report['standardization'] = pd.concat([before_stats, after_stats], axis=1)

    print(f"\n  ✅ 阶段一完成：{len(numeric_cols)} 个变量已标准化（均值为0，标准差为1）")
    return df_proc, report


def phase2_statistics(df: pd.DataFrame, numeric_cols: list, group_col: str = None):
    """Phase 2: Descriptive statistics, normality test, ANOVA."""
    print("\n" + "─" * 60)
    print("【阶段二】基础统计与假设检验")
    print("─" * 60)

    # ── 2.1 Descriptive statistics ───────────────────────────────────
    desc = df[numeric_cols].agg(['mean', 'std', 'min', 'max', 'median'])
    skew = df[numeric_cols].skew()
    kurt = df[numeric_cols].kurtosis()
    desc_table = desc.T
    desc_table['偏度'] = skew
    desc_table['峰度'] = kurt
    print("\n📊 描述统计：")
    print(desc_table.round(4).to_string())

    # ── 2.2 Shapiro-Wilk normality test ──────────────────────────────
    print("\n📊 正态性检验 (Shapiro-Wilk)：")
    sw_results = []
    for col in numeric_cols:
        col_data = df[col].dropna().values
        if len(col_data) < 3:
            sw_results.append({'变量': col, 'W统计量': np.nan, 'P值': np.nan, '正态?': '样本量不足'})
            continue
        if len(col_data) > 5000:
            col_data = np.random.choice(col_data, 5000, replace=False)
        W, p = shapiro(col_data)
        sw_results.append({
            '变量': col, 'W统计量': round(W, 4), 'P值': round(p, 4),
            '正态?': '✅ 是' if p > 0.05 else '❌ 否'
        })
    sw_table = pd.DataFrame(sw_results)
    print(sw_table.to_string(index=False))

    # ── 2.3 One-way ANOVA (or Welch / Kruskal-Wallis) ────────────────
    if group_col and group_col in df.columns:
        print(f"\n📊 单因素ANOVA（分组变量: {group_col}）：")
        groups = df[group_col].dropna().unique()
        if len(groups) < 2:
            print("  ⚠ 分组数 < 2，跳过ANOVA")
        else:
            anova_results = []
            for col in numeric_cols:
                group_data = [df[df[group_col] == g][col].dropna().values for g in groups]
                group_data = [g for g in group_data if len(g) > 0]
                if len(group_data) < 2:
                    continue
                # Levene test for homogeneity
                if all(len(g) >= 2 for g in group_data):
                    lev_stat, lev_p = levene(*group_data)
                else:
                    lev_stat, lev_p = np.nan, np.nan

                if np.isnan(lev_p) or lev_p > 0.05:
                    # Equal variances → standard ANOVA
                    f_stat, f_p = f_oneway(*group_data)
                    method = 'ANOVA'
                else:
                    # Unequal variances → Welch ANOVA via statsmodels is better, fallback Kruskal
                    try:
                        h_stat, h_p = kruskal(*group_data)
                        f_stat, f_p = h_stat, h_p
                        method = 'Kruskal-Wallis'
                    except Exception:
                        f_stat, f_p = np.nan, np.nan
                        method = 'FAILED'

                anova_results.append({
                    '因变量': col,
                    '方法': method,
                    'F/统计量': round(f_stat, 4),
                    'P值': round(f_p, 4),
                    '显著?': '✅' if f_p < 0.05 else '否',
                    '方差齐性P': round(lev_p, 4) if not np.isnan(lev_p) else 'N/A'
                })
            anova_table = pd.DataFrame(anova_results)
            print(anova_table.to_string(index=False))
    else:
        print("\n📊 单因素ANOVA：未指定分组列，跳过。请在调用时传入 group_col 参数。")

    return desc_table, sw_table


def phase3_modeling(df_raw: pd.DataFrame, df_std: pd.DataFrame, numeric_cols: list,
                    x_col: str, y_col: str, z_col: str):
    """Phase 3: Correlation matrix, RSM, PCA."""
    print("\n" + "─" * 60)
    print("【阶段三】高级建模与可视化")
    print("─" * 60)

    # ── 3.1 Correlation matrix ──────────────────────────────────────
    print(f"\n📊 相关系数矩阵（{len(numeric_cols)} 个变量）：")
    corr_matrix = df_std[numeric_cols].corr(method='pearson')
    print(corr_matrix.round(3).to_string())

    # ── 3.2 Response Surface Model (2nd order) ──────────────────────
    print(f"\n📊 响应面分析 (RSM)：")
    print(f"   X={x_col}, Y={y_col}, Z(响应)={z_col}")

    # Check that columns exist
    missing_cols = [c for c in [x_col, y_col, z_col] if c not in df_std.columns]
    if missing_cols:
        print(f"  ⚠ 列 {missing_cols} 不存在，跳过RSM")
        rsm_result = None
    else:
        # Build second-order terms
        rsm_df = pd.DataFrame({
            'z': df_std[z_col].values,
            'x': df_std[x_col].values,
            'y': df_std[y_col].values,
        })
        rsm_df['x2'] = rsm_df['x'] ** 2
        rsm_df['y2'] = rsm_df['y'] ** 2
        rsm_df['xy'] = rsm_df['x'] * rsm_df['y']

        # Fit: z = b0 + b1*x + b2*y + b3*x² + b4*y² + b5*x*y
        X_rsm = sm.add_constant(rsm_df[['x', 'y', 'x2', 'y2', 'xy']])
        y_rsm = rsm_df['z']
        model = sm.OLS(y_rsm, X_rsm).fit()

        print(f"\n  R² = {model.rsquared:.4f},  Adjusted R² = {model.rsquared_adj:.4f}")
        print(f"  F = {model.fvalue:.4f},  P = {model.f_pvalue:.6f}")
        print(f"\n  模型系数：")
        for name, coef, pval in zip(['截距', 'x', 'y', 'x²', 'y²', 'xy'],
                                    model.params, model.pvalues):
            sig = '***' if pval < 0.001 else '**' if pval < 0.01 else '*' if pval < 0.05 else ''
            print(f"    {name:6s} = {coef:+.4f}  (p={pval:.4f}) {sig}")

        # Generate prediction grid for 3D surface
        grid_n = 30
        x_range = np.linspace(rsm_df['x'].min(), rsm_df['x'].max(), grid_n)
        y_range = np.linspace(rsm_df['y'].min(), rsm_df['y'].max(), grid_n)
        Xg, Yg = np.meshgrid(x_range, y_range)

        # Predict on grid
        grid_df = pd.DataFrame({
            'const': 1,
            'x': Xg.ravel(),
            'y': Yg.ravel(),
            'x2': (Xg ** 2).ravel(),
            'y2': (Yg ** 2).ravel(),
            'xy': (Xg * Yg).ravel(),
        })
        # Ensure column order matches model
        grid_df = grid_df[['const', 'x', 'y', 'x2', 'y2', 'xy']]
        Zg_pred = model.predict(grid_df).values.reshape(grid_n, grid_n)

        # Check for divergence
        z_range_actual = np.ptp(y_rsm.values)
        z_range_pred = np.ptp(Zg_pred)
        if z_range_pred > 10 * z_range_actual or np.any(np.abs(Zg_pred) > 20):
            print(f"\n  ⚠ 警告：预测曲面范围异常（实际数据范围={z_range_actual:.2f}, 预测范围={z_range_pred:.2f}）")
            print(f"    曲面存在发散风险。建议：① 检查数据是否已标准化 ② 增加数据点密度 ③ 考虑使用局部回归")

        rsm_result = {
            'model': model,
            'X_grid': Xg, 'Y_grid': Yg, 'Z_grid': Zg_pred,
            'x_range': x_range, 'y_range': y_range,
            'rsquared': model.rsquared,
            'rsquared_adj': model.rsquared_adj,
            'f_pvalue': model.f_pvalue,
        }

    # ── 3.3 PCA ─────────────────────────────────────────────────────
    print(f"\n📊 主成分分析 (PCA)：")
    n_components = min(len(numeric_cols), len(df_std) - 1)
    pca = PCA(n_components=n_components)
    pca_scores = pca.fit_transform(df_std[numeric_cols])

    # Explained variance
    print("\n  方差解释：")
    for i, (ev, evr) in enumerate(zip(pca.explained_variance_, pca.explained_variance_ratio_)):
        cumsum = np.sum(pca.explained_variance_ratio_[:i + 1])
        print(f"    PC{i + 1}: 特征值={ev:.4f}, 解释方差={evr:.3%}, 累计={cumsum:.3%}")

    # Loadings
    loadings = pd.DataFrame(
        pca.components_.T,
        index=numeric_cols,
        columns=[f'PC{i + 1}' for i in range(n_components)]
    )
    print("\n  载荷矩阵：")
    print(loadings.round(4).to_string())

    return corr_matrix, rsm_result, loadings, pca


def print_full_report(phase1_report, desc_table, sw_table):
    """Print consolidated report."""
    print("\n" + "=" * 60)
    print("          预处理结果报告 — 摘要")
    print("=" * 60)

    print("\n【缺失值统计】")
    print(phase1_report['missing'].to_string())

    n_out = len(phase1_report['outliers'])
    print(f"\n【异常值】共识别 {n_out} 个异常值")
    if n_out > 0:
        print(phase1_report['outliers'].to_string(index=False))

    print("\n【标准化前后对比】")
    print(phase1_report['standardization'].round(4).to_string())


# ══════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python statistical_analysis.py <path_to_csv> [group_col] [x_col] [y_col] [z_col]")
        print("  group_col: 分组变量（用于ANOVA）")
        print("  x_col, y_col, z_col: RSM的X/Y/Z变量")
        sys.exit(1)

    csv_path = sys.argv[1]
    group_col = sys.argv[2] if len(sys.argv) > 2 else None
    rsm_x = sys.argv[3] if len(sys.argv) > 3 else None
    rsm_y = sys.argv[4] if len(sys.argv) > 4 else None
    rsm_z = sys.argv[5] if len(sys.argv) > 5 else None

    # ── Load data ──────────────────────────────────────────────────────
    print(f"📂 读取数据: {csv_path}")
    df = pd.read_csv(csv_path, encoding='utf-8-sig')
    print(f"   行数: {len(df)}, 列数: {len(df.columns)}")
    print(f"   列名: {list(df.columns)}")

    # Auto-detect numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    # Filter out obviously non-data columns (ID, index, etc.)
    non_data = ['Unnamed: 0', 'index', 'id', 'ID', 'sample_id', '序号', '编号']
    numeric_cols = [c for c in numeric_cols if c not in non_data and not c.startswith('Unnamed')]
    print(f"   数值变量: {numeric_cols}")

    if len(numeric_cols) < 3:
        print("⚠ 数值变量不足3个，跳过部分分析")
        # Continue with what we have

    # ── Phase 1: Preprocessing ─────────────────────────────────────────
    print("\n" + "─" * 60)
    print("【阶段一】数据预处理与诊断")
    print("─" * 60)
    df_std, p1_report = phase1_preprocessing(df, numeric_cols)

    # ── Phase 2: Statistics ────────────────────────────────────────────
    desc_table, sw_table = phase2_statistics(df_std, numeric_cols, group_col)

    # ── Phase 3: Modeling ──────────────────────────────────────────────
    if len(numeric_cols) >= 3:
        x_col = rsm_x or numeric_cols[0]
        y_col = rsm_y or numeric_cols[1]
        z_col = rsm_z or numeric_cols[2]
        corr_mat, rsm_res, loadings, pca_model = phase3_modeling(
            df, df_std, numeric_cols, x_col, y_col, z_col
        )

    # ── Final report ───────────────────────────────────────────────────
    print_full_report(p1_report, desc_table, sw_table)

    print("\n" + "=" * 60)
    print("  ✅ 全部分析完成。")
    print("=" * 60)
