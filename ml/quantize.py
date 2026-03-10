"""
EmotionUI — ONNX Quantization Pipeline
Quantizes the MLP model from FP32 to INT8 for browser deployment.
Compares sizes and performance.
"""

import os
import gzip
import shutil
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

try:
    import onnx
    from onnxruntime.quantization import quantize_dynamic, QuantType
    import onnxruntime as ort
except ImportError:
    print("Missing dependencies. Install with: pip install onnx onnxruntime")
    exit(1)

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
DEMO_ASSETS_DIR = os.path.join(os.path.dirname(__file__), '..', 'demo', 'assets')

FEATURES = [
    'rage_clicks', 'mouse_jitter', 'exit_intent', 'dwell_events',
    'scroll_thrash', 'dead_clicks', 'product_views', 'spec_dwell',
    'cart_add_remove', 'price_hover', 'direct_checkout', 'total_visits',
    'cart_abandons', 'hour', 'mobile',
]


def get_file_size_kb(path):
    return os.path.getsize(path) / 1024


def make_test_data(n=1000):
    """Generate random test inputs for benchmarking."""
    np.random.seed(42)
    return np.random.rand(n, len(FEATURES)).astype(np.float32) * 10


def run_inference(model_path, X):
    """Run inference and return predictions + timing."""
    import time
    session = ort.InferenceSession(model_path)
    input_name = session.get_inputs()[0].name

    start = time.perf_counter()
    for i in range(len(X)):
        session.run(None, {input_name: X[i:i+1]})
    elapsed = time.perf_counter() - start

    # Get predictions
    preds = []
    for i in range(len(X)):
        out = session.run(None, {input_name: X[i:i+1]})
        preds.append(out[0][0])

    return np.array(preds), elapsed


def main():
    os.makedirs(DEMO_ASSETS_DIR, exist_ok=True)

    print('=' * 60)
    print('EmotionUI — ONNX Quantization')
    print('=' * 60)

    # Source model
    fp32_path = os.path.join(MODELS_DIR, 'emotionui_mlp_fp32.onnx')
    if not os.path.exists(fp32_path):
        print(f'ERROR: Model not found at {fp32_path}')
        print('Run train.py first!')
        return

    fp32_size = get_file_size_kb(fp32_path)
    print(f'\nFP32 model: {fp32_size:.1f} KB')

    # Quantize to INT8
    int8_path = os.path.join(MODELS_DIR, 'emotionui_mlp_int8.onnx')
    print('\nQuantizing to INT8...')
    quantize_dynamic(
        fp32_path,
        int8_path,
        weight_type=QuantType.QInt8,
    )
    int8_size = get_file_size_kb(int8_path)
    print(f'INT8 model: {int8_size:.1f} KB')
    print(f'Size reduction: {(1 - int8_size/fp32_size)*100:.1f}%')

    # Benchmark
    print('\nBenchmarking (1000 samples)...')
    X_test = make_test_data(1000)

    fp32_preds, fp32_time = run_inference(fp32_path, X_test)
    int8_preds, int8_time = run_inference(int8_path, X_test)

    agreement = np.mean(fp32_preds == int8_preds) * 100
    print(f'\nFP32 inference: {fp32_time:.3f}s ({fp32_time/len(X_test)*1000:.2f}ms/sample)')
    print(f'INT8 inference: {int8_time:.3f}s ({int8_time/len(X_test)*1000:.2f}ms/sample)')
    print(f'Speedup: {fp32_time/int8_time:.2f}x')
    print(f'Agreement: {agreement:.1f}%')

    # Compare all models if available
    models_info = []

    rf100_path = os.path.join(MODELS_DIR, 'emotionui_rf100.onnx')
    rf50_path = os.path.join(MODELS_DIR, 'emotionui_rf50_slim.onnx')

    if os.path.exists(rf100_path):
        models_info.append(('RF100', rf100_path, get_file_size_kb(rf100_path)))
    if os.path.exists(rf50_path):
        models_info.append(('RF50-slim', rf50_path, get_file_size_kb(rf50_path)))
    models_info.append(('MLP-FP32', fp32_path, fp32_size))
    models_info.append(('MLP-INT8', int8_path, int8_size))

    # Gzip sizes
    gz_sizes = {}
    for name, path, _ in models_info:
        gz_path = path + '.gz'
        with open(path, 'rb') as f_in:
            with gzip.open(gz_path, 'wb') as f_out:
                f_out.write(f_in.read())
        gz_sizes[name] = get_file_size_kb(gz_path)

    # Copy best INT8 model to demo/assets
    best_demo = os.path.join(DEMO_ASSETS_DIR, 'model.onnx')
    shutil.copy2(int8_path, best_demo)

    best_demo_gz = best_demo + '.gz'
    with open(int8_path, 'rb') as f_in:
        with gzip.open(best_demo_gz, 'wb') as f_out:
            f_out.write(f_in.read())

    print(f'\nBest model (INT8) copied to demo/assets/')
    print(f'  model.onnx:    {get_file_size_kb(best_demo):.1f} KB')
    print(f'  model.onnx.gz: {get_file_size_kb(best_demo_gz):.1f} KB')

    # Plot quantization results
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    names = [m[0] for m in models_info]
    sizes = [m[2] for m in models_info]
    gz = [gz_sizes.get(n, 0) for n in names]
    colors = ['#4361ee', '#6366f1', '#7c3aed', '#a78bfa']

    # Size comparison
    x = np.arange(len(names))
    width = 0.35
    ax1.bar(x - width/2, sizes, width, label='Raw', color=colors[:len(names)])
    ax1.bar(x + width/2, gz, width, label='Gzipped', color=[c + '80' for c in colors[:len(names)]], alpha=0.7)
    ax1.set_xticks(x)
    ax1.set_xticklabels(names, rotation=15)
    ax1.set_ylabel('Size (KB)')
    ax1.set_title('Model Size Comparison')
    ax1.legend()
    ax1.spines['top'].set_visible(False)
    ax1.spines['right'].set_visible(False)

    # Inference speed (only FP32 vs INT8)
    ax2.bar(['MLP-FP32', 'MLP-INT8'],
            [fp32_time/len(X_test)*1000, int8_time/len(X_test)*1000],
            color=['#7c3aed', '#a78bfa'], width=0.5)
    ax2.set_ylabel('Latency (ms/sample)')
    ax2.set_title('Inference Speed')
    ax2.spines['top'].set_visible(False)
    ax2.spines['right'].set_visible(False)

    path = os.path.join(MODELS_DIR, 'quantization_results.png')
    plt.tight_layout()
    plt.savefig(path, dpi=150)
    plt.close()
    print(f'\nSaved quantization_results.png')

    # Summary table
    print('\n' + '=' * 60)
    print('Summary')
    print('=' * 60)
    print(f'  {"Model":15s}  {"Size":>8s}  {"Gzipped":>8s}')
    print(f'  {"-"*15}  {"-"*8}  {"-"*8}')
    for name, path, size in models_info:
        gz_s = gz_sizes.get(name, 0)
        print(f'  {name:15s}  {size:7.1f}K  {gz_s:7.1f}K')

    print(f'\n  Winner: MLP-INT8 ({get_file_size_kb(best_demo_gz):.1f} KB gzipped)')
    print('  Done!')


if __name__ == '__main__':
    main()
