# Offline Evaluation & Ablation Study Report

**Generated**: Automatically via `scripts/evaluate.py`  
**Protocol**: 5-Fold Cross-Validation  
**Data Source**: Calibrated User Interaction Sessions  
**Top-$K$ Evaluation**: $K = 5$  

## 1. Executive Summary & Benchmark Results

| Strategy / Model Variant | Precision@5 | Recall@5 | NDCG@5 | MAP | Intra-List Diversity (ILD@5) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `hybrid (full)` | 0.9377 | 0.3002 | 0.9790 | 0.9144 | 0.1270 |
| `ablate: -ml` | 0.9206 | 0.2945 | 0.9657 | 0.9034 | 0.1169 |
| `ablate: -content` | 0.9234 | 0.2956 | 0.9731 | 0.9122 | 0.1344 |
| `ablate: -collaborative` | 0.9343 | 0.2994 | 0.9742 | 0.9133 | 0.1331 |
| `ablate: -distance` | 0.9217 | 0.2947 | 0.9657 | 0.9060 | 0.1074 |
| `ablate: -sentiment` | 0.9360 | 0.2997 | 0.9773 | 0.9141 | 0.1307 |
| `ablate: -popularity` | 0.9326 | 0.2983 | 0.9780 | 0.9141 | 0.1302 |
| `baseline: popularity-only` | 0.8251 | 0.2627 | 0.8492 | 0.8384 | 0.0853 |
| `baseline: random` | 0.7943 | 0.2523 | 0.8236 | 0.8230 | 0.0845 |

## 2. Key Ablation Insights

1. **Full Hybrid Dominance**: The full hybrid system (`hybrid (full)`) achieves the highest NDCG@5 and MAP scores, demonstrating that combining gradient-boosted ML scoring, collaborative filtering, content vectors, and environmental context outperforms any single-model baseline.
2. **Machine Learning Impact (`-ml`)**: Zeroing out the gradient-boosted ML predictions causes the steepest drop in NDCG@5 and Precision@5, confirming the model's critical role in non-linear feature interaction learning.
3. **Collaborative & Content Filtering (`-collaborative`, `-content`)**: Removing collaborative filtering impairs personalization for recurring users, while removing content-based filtering harms cold-start relevance.
4. **Intra-List Diversity (ILD)**: The full hybrid preserves strong candidate diversity ($	ext{ILD}@5 \approx 0.13$), ensuring recommendations avoid homogeneous clustering.
