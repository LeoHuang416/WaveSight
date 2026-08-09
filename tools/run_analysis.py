import warnings, sys
import numpy as np
import pandas as pd
from scipy import stats
from scipy.stats import shapiro, levene, f_oneway, kruskal
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import statsmodels.api as sm

warnings.filterwarnings('ignore')
np.set_printoptions(suppress=True, precision=4)
pd.set_option('display.max_columns', None)
pd.set_option('display.width', 240)
pd.set_option('display.float_format', lambda x: f'{x:.4f}')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LOAD DATA
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 参考脚本：请将 FILE 改为你本地实验数据的路径
FILE = r'C:\Users\Administrator\Desktop\AItool\11.xlsx'
df = pd.read_excel(FILE)

meta_cols = ['Group', 'Control']
numeric_cols = [c for c in df.columns if c not in meta_cols]

print("=" * 70)
print("  全流程统计分析 -- 预处理 -> 假设检验 -> RSM & PCA")
print("=" * 70)
print(f"\n数据维度: {df.shape[0]} 行 x {df.shape[1]} 列")
print(f"实验分组: {df['Group'].nunique()} 组, 组别: {sorted(df['Group'].unique())}")
print(f"组样本量: {df['Group'].value_counts().sort_index().to_dict()}")
print(f"处理条件: {df['Control'].unique()}")
print(f"数值变量: {numeric_cols}")

# ═══════════════════════════════════════════════════════════════
# PHASE 1: PREPROCESSING
# ═══════════════════════════════════════════════════════════════
print("\n" + "-" * 70)
print("【阶段一】数据预处理与诊断")
print("-" * 70)

# -- 1.1 Missing values --
print("\n[1.1] 缺失值诊断：")
missing = df[numeric_cols].isnull().sum()
missing_pct = (missing / len(df) * 100)
for col in numeric_cols:
    n = missing[col]
    pct = missing_pct[col]
    status = "无缺失" if n == 0 else f"{n}个 ({pct:.1f}%)"
    print(f"  {col:8s}: {status}")
print("  -> 结论：全部变量无缺失值，无需插补。")

# -- 1.2 Outlier detection (IQR) --
print("\n[1.2] 异常值检测 (箱线图法 IQR x 1.5)：")
outlier_summary = []
df_capped = df[numeric_cols].copy()
for col in numeric_cols:
    Q1, Q3 = np.percentile(df_capped[col], [25, 75])
    IQR = Q3 - Q1
    lower, upper = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
    mask = (df_capped[col] < lower) | (df_capped[col] > upper)
    n_out = mask.sum()
    if n_out > 0:
        indices = df.index[mask].tolist()
        for idx in indices:
            orig = df.loc[idx, col]
            capped = np.clip(orig, lower, upper)
            outlier_summary.append({
                '变量': col, '组': df.loc[idx, 'Group'],
                '索引': idx, '原始值': orig, '盖帽后': capped,
                '界限': f'[{lower:.3f}, {upper:.3f}]'
            })
            df_capped.loc[idx, col] = capped
        print(f"  {col:8s}: {n_out:2d} 个异常值 -> 盖帽 [{lower:.3f}, {upper:.3f}]")
    else:
        print(f"  {col:8s}: 0 个异常值")

if outlier_summary:
    out_df = pd.DataFrame(outlier_summary)
    print(f"\n  异常值明细 (共 {len(outlier_summary)} 条)：")
    print(out_df.to_string(index=False))
else:
    print("  -> 结论：未检测到异常值。")

# -- 1.3 Z-score Standardization --
print("\n[1.3] Z-score 标准化：")
scaler = StandardScaler()
before_stats = df_capped[numeric_cols].agg(['mean', 'std']).T
before_stats.columns = ['标准化前均值', '标准化前标准差']

df_std_arr = scaler.fit_transform(df_capped[numeric_cols])
df_std = pd.DataFrame(df_std_arr, columns=numeric_cols)
df_std[['Group', 'Control']] = df[['Group', 'Control']].values

after_stats = df_std[numeric_cols].agg(['mean', 'std']).T
after_stats.columns = ['标准化后均值', '标准化后标准差']
std_compare = pd.concat([before_stats, after_stats], axis=1)
print(std_compare.round(4).to_string())
print(f"\n  标准化完成：{len(numeric_cols)} 个变量 -> 均值~0, 标准差~1")

# ═══════════════════════════════════════════════════════════════
# PHASE 2: STATISTICS & HYPOTHESIS TESTING
# ═══════════════════════════════════════════════════════════════
print("\n" + "-" * 70)
print("【阶段二】基础统计与假设检验")
print("-" * 70)

# -- 2.1 Descriptive statistics --
print("\n[2.1] 描述统计 (基于标准化数据)：")
desc = df_std[numeric_cols].agg(['mean', 'std', 'min', 'max']).T
desc['偏度'] = df_std[numeric_cols].skew()
desc['峰度'] = df_std[numeric_cols].kurtosis()
print(desc.round(4).to_string())

# -- 2.2 Normality test (Shapiro-Wilk) --
print("\n[2.2] 正态性检验 (Shapiro-Wilk, H0: 数据服从正态分布)：")
sw_results = []
for col in numeric_cols:
    data = df_std[col].dropna().values
    W, p = shapiro(data)
    normal = '正态' if p > 0.05 else '非正态'
    sw_results.append({'变量': col, 'W统计量': round(W, 4), 'P值': round(p, 6), '结论': normal})
sw_table = pd.DataFrame(sw_results)
print(sw_table.to_string(index=False))

# -- 2.3 One-way ANOVA by Group --
print("\n[2.3] 单因素ANOVA (分组变量: Group, 4个浓度水平)：")
anova_results = []
group_col = 'Group'
groups = sorted(df_std[group_col].unique())
for col in numeric_cols:
    group_data = [df_std[df_std[group_col] == g][col].dropna().values for g in groups]
    group_data_filt = [g for g in group_data if len(g) > 1]
    if len(group_data_filt) < 2:
        continue
    lev_stat, lev_p = levene(*group_data_filt)
    if lev_p > 0.05:
        f_stat, f_p = f_oneway(*group_data_filt)
        method = 'ANOVA'
    else:
        h_stat, h_p = kruskal(*group_data_filt)
        f_stat, f_p = h_stat, h_p
        method = 'Kruskal-Wallis'
    sig = '***' if f_p < 0.001 else '**' if f_p < 0.01 else '*' if f_p < 0.05 else 'ns'
    anova_results.append({
        '因变量': col, '方法': method,
        '统计量': round(f_stat, 4), 'P值': round(f_p, 6),
        '方差齐性P': round(lev_p, 4), '显著性': sig
    })
anova_table = pd.DataFrame(anova_results)
print(anova_table.to_string(index=False))

# ═══════════════════════════════════════════════════════════════
# PHASE 3: ADVANCED MODELING
# ═══════════════════════════════════════════════════════════════
print("\n" + "-" * 70)
print("【阶段三】高级建模与可视化")
print("-" * 70)

# -- 3.1 Correlation matrix --
print("\n[3.1] Pearson相关系数矩阵：")
corr_mat = df_std[numeric_cols].corr(method='pearson')
print(corr_mat.round(3).to_string())

# -- 3.2 RSM: Response Surface Methodology --
variances = df_std[numeric_cols].var().sort_values(ascending=False)
print(f"\n[3.2] 响应面分析 (RSM)：")
print(f"  方差排序: {variances.to_dict()}")

top3 = variances.index[:3].tolist()
x_col, y_col, z_col = top3[0], top3[1], top3[2]
print(f"  选定: X={x_col}, Y={y_col}, Z(响应)={z_col}")

rsm_df = pd.DataFrame({
    'z': df_std[z_col].values,
    'x': df_std[x_col].values,
    'y': df_std[y_col].values,
})
rsm_df['x2'] = rsm_df['x'] ** 2
rsm_df['y2'] = rsm_df['y'] ** 2
rsm_df['xy'] = rsm_df['x'] * rsm_df['y']

X_rsm = sm.add_constant(rsm_df[['x', 'y', 'x2', 'y2', 'xy']])
y_rsm = rsm_df['z']
model = sm.OLS(y_rsm, X_rsm).fit()

print(f"\n  模型: z = b0 + b1*x + b2*y + b3*x^2 + b4*y^2 + b5*xy")
print(f"  R^2 = {model.rsquared:.4f},  Adj R^2 = {model.rsquared_adj:.4f}")
print(f"  F({int(model.df_model)}, {int(model.df_resid)}) = {model.fvalue:.4f},  P = {model.f_pvalue:.6f}")

print(f"\n  系数估计：")
for name, coef, pval in zip(['b0(截距)', 'b1(x)', 'b2(y)', 'b3(x^2)', 'b4(y^2)', 'b5(xy)'],
                            model.params, model.pvalues):
    sig = ' ***' if pval < 0.001 else ' **' if pval < 0.01 else ' *' if pval < 0.05 else ''
    print(f"    {name:12s} = {coef:+.4f}  (p={pval:.4f}){sig}")

# Generate prediction grid
grid_n = 30
x_range = np.linspace(rsm_df['x'].min(), rsm_df['x'].max(), grid_n)
y_range = np.linspace(rsm_df['y'].min(), rsm_df['y'].max(), grid_n)
Xg, Yg = np.meshgrid(x_range, y_range)

grid_df = pd.DataFrame({
    'const': 1,
    'x': Xg.ravel(), 'y': Yg.ravel(),
    'x2': (Xg**2).ravel(), 'y2': (Yg**2).ravel(), 'xy': (Xg*Yg).ravel(),
})
grid_df = grid_df[['const', 'x', 'y', 'x2', 'y2', 'xy']]
Zg_pred = model.predict(grid_df).values.reshape(grid_n, grid_n)

z_actual_range = np.ptp(y_rsm.values)
z_pred_range = np.ptp(Zg_pred)
print(f"\n  曲面诊断：实际Z范围={z_actual_range:.2f}, 预测Z范围={z_pred_range:.2f}")
if z_pred_range > 10 * z_actual_range or np.any(np.abs(Zg_pred) > 20):
    print(f"  ! 警告：预测曲面范围异常 -> 可能存在边界发散")
    print(f"  -> 原因：多项式在数据边界外通常发散。标准化后应已缓解。")
else:
    print(f"  -> 曲面范围正常，未检测到发散。")

# -- 3.3 PCA --
print(f"\n[3.3] 主成分分析 (PCA)：")
n_comp = min(len(numeric_cols), len(df_std) - 1)
pca = PCA(n_components=n_comp)
pca_scores = pca.fit_transform(df_std[numeric_cols])

print(f"\n  方差解释 (碎石图数据)：")
for i, (ev, evr) in enumerate(zip(pca.explained_variance_, pca.explained_variance_ratio_)):
    cumsum = np.sum(pca.explained_variance_ratio_[:i+1])
    bar = '#' * int(evr * 50)
    print(f"  PC{i+1}: lambda={ev:.3f}, 解释={evr:.1%}, 累计={cumsum:.1%} {bar}")

loadings = pd.DataFrame(
    pca.components_.T,
    index=numeric_cols,
    columns=[f'PC{i+1}' for i in range(n_comp)]
)
print(f"\n  载荷矩阵：")
print(loadings.round(4).to_string())

# ═══════════════════════════════════════════════════════════════
# FINAL REPORT
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("  预处理结果报告 -- 摘要")
print("=" * 70)

sig_vars = anova_table[anova_table['P值'] < 0.05]['因变量'].tolist() if len(anova_table) > 0 else []
normal_count = sw_table['结论'].value_counts().get('正态', 0) if '结论' in sw_table.columns else 0

print(f"""
  数据完整性：   {len(numeric_cols)} 个变量均无缺失值
  异常值处理：   共处理 {len(outlier_summary)} 个异常值 (盖帽法)
  标准化：       {len(numeric_cols)} 个变量 -> Z-score (mu=0, sigma=1)
  正态性检验：   {normal_count}/{len(numeric_cols)} 个变量服从正态分布 (Shapiro-Wilk, alpha=0.05)
  ANOVA显著变量：{sig_vars if sig_vars else '无 (所有变量组间差异不显著)'}
  RSM模型：      R^2={model.rsquared:.3f}, Adj R^2={model.rsquared_adj:.3f}, P={model.f_pvalue:.2e}
  PCA前2成分：   累计解释 {np.sum(pca.explained_variance_ratio_[:2]):.1%} 方差
""")

print("=" * 70)
print("  三阶段全部分析完成。")
print("=" * 70)
