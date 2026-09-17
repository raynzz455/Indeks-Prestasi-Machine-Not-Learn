"""
Course model — course difficulty classification using K-Means.

This is a standalone course model that can be used independently
of the full pipeline. It wraps the K-Means clustering logic.

Status: IMPLEMENTED in mini-services/ml-service/src/train_models.py
        This is a stub for the original pipeline structure.
"""

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import numpy as np
import joblib
from pathlib import Path

DIFFICULTY_LABELS = ["sangat_mudah", "mudah", "medium", "sulit", "sangat_sulit"]


class CourseModel:
    """Standalone course difficulty classifier using K-Means."""

    def __init__(self, n_clusters=5, random_state=42):
        self.n_clusters = n_clusters
        self.random_state = random_state
        self.kmeans = None
        self.scaler = None
        self.cluster_order = {}

    def fit(self, X):
        """Fit K-Means on course feature matrix."""
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        self.kmeans = KMeans(n_clusters=self.n_clusters,
                             random_state=self.random_state,
                             n_init=10, max_iter=300)
        clusters = self.kmeans.fit_predict(X_scaled)

        # Sort by mean feature value (easiest → hardest)
        for c in range(self.n_clusters):
            mask = clusters == c
            if mask.sum() > 0:
                mean_val = X[mask, 0].mean()  # mean_gp is first feature
                self.cluster_order[c] = (c, mean_val)

        sorted_order = sorted(self.cluster_order.values(),
                              key=lambda x: -x[1])
        self.cluster_order = {orig: rank for rank, (orig, _) in enumerate(sorted_order)}

        return clusters

    def predict(self, X):
        """Predict difficulty cluster for new courses."""
        X_scaled = self.scaler.transform(X)
        clusters = self.kmeans.predict(X_scaled)
        return [DIFFICULTY_LABELS[self.cluster_order[c]] for c in clusters]

    def save(self, path="models/trained/course_model.joblib"):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)

    @classmethod
    def load(cls, path="models/trained/course_model.joblib"):
        return joblib.load(path)
