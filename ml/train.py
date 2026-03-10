"""
EmotionUI — ML Training Pipeline
Generates 100k synthetic samples, trains RF + MLP classifiers, exports to ONNX.
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# ——— Configuration ———
N_SAMPLES = 100_000
RANDOM_STATE = 42
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'models')
DEMO_ASSETS_DIR = os.path.join(os.path.dirname(__file__), '..', 'demo', 'assets')

STATES = [
    'STANDARD',          # 0
    'EXPRESS_LANE',      # 1
    'PRICE_ALERT_MODE',  # 2
    'DESIGN_OXYGEN',     # 3
    'NEGOTIATOR_MODE',   # 4
    'RESEARCH_MODE',     # 5
    'SPOTLIGHT_MODE',    # 6
    'EDITORIAL_MODE',    # 7
]

FEATURES = [
    'rage_clicks', 'mouse_jitter', 'exit_intent', 'dwell_events',
    'scroll_thrash', 'dead_clicks', 'product_views', 'spec_dwell',
    'cart_add_remove', 'price_hover', 'direct_checkout', 'total_visits',
    'cart_abandons', 'hour', 'mobile',
]

np.random.seed(RANDOM_STATE)


def generate_samples(n):
    """Generate synthetic behavioral samples with realistic distributions per state."""
    samples_per_state = n // len(STATES)
    extra = n - samples_per_state * len(STATES)

    all_samples = []

    for state_idx, state in enumerate(STATES):
        count = samples_per_state + (1 if state_idx < extra else 0)
        s = np.zeros((count, len(FEATURES)))

        if state == 'STANDARD':
            s[:, 0] = np.random.poisson(0.5, count)         # rage_clicks
            s[:, 1] = np.random.exponential(0.5, count)      # mouse_jitter
            s[:, 2] = np.random.poisson(0.3, count)          # exit_intent
            s[:, 3] = np.random.poisson(1.0, count)          # dwell_events
            s[:, 4] = np.random.exponential(0.3, count)      # scroll_thrash
            s[:, 5] = np.random.poisson(0.5, count)          # dead_clicks
            s[:, 6] = np.random.poisson(1.5, count)          # product_views
            s[:, 7] = np.random.poisson(0.5, count)          # spec_dwell
            s[:, 8] = np.random.exponential(0.3, count)      # cart_add_remove
            s[:, 9] = np.random.poisson(0.5, count)          # price_hover
            s[:, 10] = 0                                      # direct_checkout
            s[:, 11] = np.random.poisson(1.5, count)         # total_visits
            s[:, 12] = np.random.poisson(0.3, count)         # cart_abandons
            s[:, 13] = np.random.randint(6, 24, count)       # hour
            s[:, 14] = np.random.binomial(1, 0.4, count)     # mobile

        elif state == 'EXPRESS_LANE':
            s[:, 0] = np.random.poisson(0.2, count)
            s[:, 1] = np.random.exponential(0.3, count)
            s[:, 2] = np.random.poisson(0.1, count)
            s[:, 3] = np.random.poisson(0.5, count)
            s[:, 4] = np.random.exponential(0.2, count)
            s[:, 5] = np.random.poisson(0.2, count)
            s[:, 6] = np.random.poisson(1.0, count)
            s[:, 7] = np.random.poisson(0.3, count)
            s[:, 8] = np.random.exponential(0.2, count)
            s[:, 9] = np.random.poisson(0.3, count)
            s[:, 10] = 1                                      # direct_checkout = True
            s[:, 11] = np.random.poisson(2.0, count) + 1
            s[:, 12] = np.random.poisson(0.1, count)
            s[:, 13] = np.random.randint(8, 22, count)
            s[:, 14] = np.random.binomial(1, 0.35, count)

        elif state == 'PRICE_ALERT_MODE':
            s[:, 0] = np.random.poisson(1.0, count)
            s[:, 1] = np.random.exponential(1.0, count)
            s[:, 2] = np.random.poisson(1.0, count)
            s[:, 3] = np.random.poisson(2.0, count)
            s[:, 4] = np.random.exponential(0.8, count)
            s[:, 5] = np.random.poisson(0.8, count)
            s[:, 6] = np.random.poisson(2.0, count)
            s[:, 7] = np.random.poisson(1.0, count)
            s[:, 8] = np.random.exponential(1.5, count)
            s[:, 9] = np.random.poisson(3.0, count) + 2     # price_hover >= 2
            s[:, 10] = 0
            s[:, 11] = np.random.poisson(3.0, count) + 3    # total_visits >= 3
            s[:, 12] = np.random.poisson(2.0, count) + 2    # cart_abandons >= 2
            s[:, 13] = np.random.randint(8, 22, count)
            s[:, 14] = np.random.binomial(1, 0.45, count)

        elif state == 'DESIGN_OXYGEN':
            s[:, 0] = np.random.poisson(5.0, count) + 2     # rage_clicks high
            s[:, 1] = np.random.exponential(3.0, count) + 3 # jitter high
            s[:, 2] = np.random.poisson(1.5, count)
            s[:, 3] = np.random.poisson(3.0, count)
            s[:, 4] = np.random.exponential(2.0, count) + 2 # scroll_thrash high
            s[:, 5] = np.random.poisson(2.0, count)
            s[:, 6] = np.random.poisson(2.0, count)
            s[:, 7] = np.random.poisson(0.5, count)
            s[:, 8] = np.random.exponential(0.5, count)
            s[:, 9] = np.random.poisson(0.5, count)
            s[:, 10] = 0
            s[:, 11] = np.random.poisson(2.0, count)
            s[:, 12] = np.random.poisson(1.0, count)
            s[:, 13] = np.random.randint(8, 23, count)
            s[:, 14] = np.random.binomial(1, 0.5, count)

        elif state == 'NEGOTIATOR_MODE':
            s[:, 0] = np.random.poisson(1.0, count)
            s[:, 1] = np.random.exponential(1.0, count)
            s[:, 2] = np.random.poisson(2.5, count) + 2     # exit_intent >= 2
            s[:, 3] = np.random.poisson(2.0, count)
            s[:, 4] = np.random.exponential(0.8, count)
            s[:, 5] = np.random.poisson(0.8, count)
            s[:, 6] = np.random.poisson(2.0, count)
            s[:, 7] = np.random.poisson(1.0, count)
            s[:, 8] = np.random.exponential(1.0, count)
            s[:, 9] = np.random.poisson(2.0, count) + 1     # price_hover >= 2
            s[:, 10] = 0
            s[:, 11] = np.random.poisson(2.0, count) + 1
            s[:, 12] = np.random.poisson(1.5, count) + 1    # cart_abandons >= 1
            s[:, 13] = np.random.randint(8, 23, count)
            s[:, 14] = np.random.binomial(1, 0.45, count)

        elif state == 'RESEARCH_MODE':
            s[:, 0] = np.random.poisson(0.3, count)
            s[:, 1] = np.random.exponential(0.4, count)
            s[:, 2] = np.random.poisson(0.3, count)
            s[:, 3] = np.random.poisson(2.0, count)
            s[:, 4] = np.random.exponential(0.5, count)
            s[:, 5] = np.random.poisson(0.5, count)
            s[:, 6] = np.random.poisson(4.0, count) + 2     # product_views high
            s[:, 7] = np.random.poisson(3.5, count) + 2     # spec_dwell >= 3
            s[:, 8] = np.random.exponential(0.3, count)
            s[:, 9] = np.random.poisson(1.0, count)
            s[:, 10] = 0
            s[:, 11] = np.random.poisson(2.0, count)
            s[:, 12] = np.random.poisson(0.3, count)
            s[:, 13] = np.random.randint(8, 22, count)
            s[:, 14] = np.random.binomial(1, 0.3, count)

        elif state == 'SPOTLIGHT_MODE':
            s[:, 0] = np.random.poisson(1.5, count)
            s[:, 1] = np.random.exponential(1.5, count)
            s[:, 2] = np.random.poisson(0.8, count)
            s[:, 3] = np.random.poisson(5.0, count) + 3     # dwell_events >= 5
            s[:, 4] = np.random.exponential(1.0, count)
            s[:, 5] = np.random.poisson(3.0, count) + 1     # dead_clicks high
            s[:, 6] = np.random.poisson(2.0, count)
            s[:, 7] = np.random.poisson(1.0, count)
            s[:, 8] = np.random.exponential(0.5, count)
            s[:, 9] = np.random.poisson(0.8, count)
            s[:, 10] = 0
            s[:, 11] = np.random.poisson(1.5, count)
            s[:, 12] = np.random.poisson(0.5, count)
            s[:, 13] = np.random.randint(8, 22, count)
            s[:, 14] = np.random.binomial(1, 0.4, count)

        elif state == 'EDITORIAL_MODE':
            s[:, 0] = np.random.poisson(0.3, count)
            s[:, 1] = np.random.exponential(0.3, count)
            s[:, 2] = np.random.poisson(0.3, count)
            s[:, 3] = np.random.poisson(1.5, count)
            s[:, 4] = np.random.exponential(0.3, count)
            s[:, 5] = np.random.poisson(0.3, count)
            s[:, 6] = np.random.poisson(1.0, count)
            s[:, 7] = np.random.poisson(0.5, count)
            s[:, 8] = np.random.exponential(0.2, count)
            s[:, 9] = np.random.poisson(0.3, count)
            s[:, 10] = 0
            s[:, 11] = np.random.poisson(0.5, count) + 1    # total_visits <= 2
            s[:, 11] = np.clip(s[:, 11], 1, 2)
            s[:, 12] = np.random.poisson(0.2, count)
            s[:, 13] = np.random.randint(20, 24, count)      # hour >= 20
            s[:, 14] = 1                                       # mobile = True

        labels = np.full(count, state_idx)
        all_samples.append((s, labels))

    X = np.vstack([s[0] for s in all_samples])
    y = np.concatenate([s[1] for s in all_samples])

    # Add noise: 5% label noise for realism
    noise_mask = np.random.random(len(y)) < 0.05
    y[noise_mask] = np.random.randint(0, len(STATES), noise_mask.sum())

    # Shuffle
    idx = np.random.permutation(len(y))
    X, y = X[idx], y[idx]

    return X.astype(np.float32), y.astype(np.int64)


def train_models(X_train, X_test, y_train, y_test):
    """Train RF100, RF50-slim, MLP, and return results."""
    results = {}

    # 1. Random Forest — 100 trees
    print('\n[1/3] Training Random Forest (100 trees)...')
    rf100 = RandomForestClassifier(n_estimators=100, random_state=RANDOM_STATE, n_jobs=-1)
    rf100.fit(X_train, y_train)
    rf100_pred = rf100.predict(X_test)
    rf100_acc = accuracy_score(y_test, rf100_pred)
    print(f'  RF100 Accuracy: {rf100_acc:.4f}')
    results['RF100'] = {'model': rf100, 'accuracy': rf100_acc, 'preds': rf100_pred}

    # 2. Random Forest — 50 trees (slim)
    print('\n[2/3] Training Random Forest (50 trees, slim)...')
    rf50 = RandomForestClassifier(n_estimators=50, max_depth=12, random_state=RANDOM_STATE, n_jobs=-1)
    rf50.fit(X_train, y_train)
    rf50_pred = rf50.predict(X_test)
    rf50_acc = accuracy_score(y_test, rf50_pred)
    print(f'  RF50-slim Accuracy: {rf50_acc:.4f}')
    results['RF50-slim'] = {'model': rf50, 'accuracy': rf50_acc, 'preds': rf50_pred}

    # 3. MLP (64→32→16)
    print('\n[3/3] Training MLP (64→32→16)...')
    mlp = MLPClassifier(
        hidden_layer_sizes=(64, 32, 16),
        activation='relu',
        max_iter=300,
        random_state=RANDOM_STATE,
        early_stopping=True,
        validation_fraction=0.1,
        batch_size=256,
    )
    mlp.fit(X_train, y_train)
    mlp_pred = mlp.predict(X_test)
    mlp_acc = accuracy_score(y_test, mlp_pred)
    print(f'  MLP Accuracy: {mlp_acc:.4f}')
    results['MLP-FP32'] = {'model': mlp, 'accuracy': mlp_acc, 'preds': mlp_pred}

    return results


def export_to_onnx(model, name, n_features):
    """Export sklearn model to ONNX format."""
    initial_type = [('input', FloatTensorType([None, n_features]))]
    options = {id(model): {'zipmap': False}}
    onnx_model = convert_sklearn(model, name, initial_types=initial_type, options=options)

    path = os.path.join(OUTPUT_DIR, f'{name}.onnx')
    with open(path, 'wb') as f:
        f.write(onnx_model.SerializeToString())

    size_kb = os.path.getsize(path) / 1024
    print(f'  Exported {name}.onnx ({size_kb:.1f} KB)')
    return path, size_kb


def plot_training_results(results):
    """Generate training results comparison chart."""
    fig, ax = plt.subplots(figsize=(10, 5))

    names = list(results.keys())
    accs = [results[n]['accuracy'] for n in names]
    colors = ['#4361ee', '#6366f1', '#7c3aed', '#a78bfa']

    bars = ax.bar(names, accs, color=colors[:len(names)], width=0.6)
    for bar, acc in zip(bars, accs):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.003,
                f'{acc:.3f}', ha='center', va='bottom', fontweight='bold', fontsize=12)

    ax.set_ylim(0.5, 1.02)
    ax.set_ylabel('Accuracy', fontsize=12)
    ax.set_title('EmotionUI — Model Comparison', fontsize=14, fontweight='bold')
    ax.grid(axis='y', alpha=0.3)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    path = os.path.join(OUTPUT_DIR, 'training_results.png')
    plt.tight_layout()
    plt.savefig(path, dpi=150)
    plt.close()
    print(f'  Saved training_results.png')


def plot_feature_importance(model, feature_names):
    """Plot feature importance from RF model."""
    fig, ax = plt.subplots(figsize=(10, 6))

    importances = model.feature_importances_
    idx = np.argsort(importances)

    ax.barh(range(len(idx)), importances[idx], color='#4361ee', height=0.6)
    ax.set_yticks(range(len(idx)))
    ax.set_yticklabels([feature_names[i] for i in idx])
    ax.set_xlabel('Importance', fontsize=12)
    ax.set_title('EmotionUI — Signal Importance', fontsize=14, fontweight='bold')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    path = os.path.join(OUTPUT_DIR, 'signal_importance.png')
    plt.tight_layout()
    plt.savefig(path, dpi=150)
    plt.close()
    print(f'  Saved signal_importance.png')


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(DEMO_ASSETS_DIR, exist_ok=True)

    print('=' * 60)
    print('EmotionUI — ML Training Pipeline')
    print('=' * 60)

    # Generate data
    print(f'\nGenerating {N_SAMPLES:,} synthetic samples...')
    X, y = generate_samples(N_SAMPLES)
    print(f'  Shape: X={X.shape}, y={y.shape}')
    print(f'  Classes: {dict(zip(*np.unique(y, return_counts=True)))}')

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )
    print(f'  Train: {len(X_train):,}, Test: {len(X_test):,}')

    # Train
    results = train_models(X_train, X_test, y_train, y_test)

    # Classification report for best model
    print('\n' + '=' * 60)
    print('Classification Report — MLP-FP32:')
    print('=' * 60)
    print(classification_report(y_test, results['MLP-FP32']['preds'], target_names=STATES))

    # Export all to ONNX
    print('\nExporting models to ONNX...')
    onnx_sizes = {}
    for name, data in results.items():
        path, size = export_to_onnx(data['model'], f'emotionui_{name.lower().replace("-", "_")}', len(FEATURES))
        onnx_sizes[name] = size

    # Export winner (MLP) as the main model
    winner_src = os.path.join(OUTPUT_DIR, 'emotionui_mlp_fp32.onnx')
    winner_dst = os.path.join(OUTPUT_DIR, 'emotionui_model.onnx')

    import shutil
    shutil.copy2(winner_src, winner_dst)
    print(f'\n  Winner model copied to: {winner_dst}')

    # Copy to demo/assets
    demo_dst = os.path.join(DEMO_ASSETS_DIR, 'model.onnx')
    shutil.copy2(winner_src, demo_dst)
    print(f'  Demo copy: {demo_dst}')

    # Gzip for browser
    import gzip
    gz_path = demo_dst + '.gz'
    with open(winner_src, 'rb') as f_in:
        with gzip.open(gz_path, 'wb') as f_out:
            f_out.write(f_in.read())
    gz_size = os.path.getsize(gz_path) / 1024
    print(f'  Gzipped: {gz_path} ({gz_size:.1f} KB)')

    # Plots
    print('\nGenerating plots...')
    plot_training_results(results)
    plot_feature_importance(results['RF100']['model'], FEATURES)

    # Summary
    print('\n' + '=' * 60)
    print('Summary')
    print('=' * 60)
    for name in results:
        acc = results[name]['accuracy']
        size = onnx_sizes.get(name, 0)
        print(f'  {name:15s}  acc={acc:.4f}  size={size:.1f}KB')

    print(f'\n  Winner: MLP-FP32')
    print(f'  Output: {OUTPUT_DIR}/')
    print('  Done!')


if __name__ == '__main__':
    main()
