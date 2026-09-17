"""
Model definitions — K-Means + Logistic Regression + Random Forest.

Status: IMPLEMENTED in mini-services/ml-service/src/train_models.py
        using scikit-learn. This is a stub for the original structure.
"""

from sklearn.cluster import KMeans
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import joblib
from pathlib import Path

# Grade scale (10 classes)
GRADE_POINTS = {
    "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "E": 0.0,
}
GRADE_ORDER = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "E"]


class CourseDifficultyClusterer:
    """Model 1: K-Means clustering for course difficulty."""

    def __init__(self, n_clusters=5, random_state=42):
        self.n_clusters = n_clusters
        self.random_state = random_state
        self.model = None
        self.scaler = None
        self.labels = ["sangat_mudah", "mudah", "medium", "sulit", "sangat_sulit"]

    def fit_predict(self, features_df):
        """Fit K-Means on course features and return labeled DataFrame."""
        feature_cols = ["mean_gp", "std_gp", "pct_a_or_above", "pct_below_b",
                        "pct_fail", "median_gp", "iqr_gp", "mean_ips_takers"]
        X = features_df[feature_cols].values

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        self.model = KMeans(n_clusters=self.n_clusters, random_state=self.random_state,
                            n_init=10, max_iter=300)
        clusters = self.model.fit_predict(X_scaled)

        # Sort clusters by mean grade point (easiest → hardest)
        cluster_means = []
        for c in range(self.n_clusters):
            mask = clusters == c
            if mask.sum() > 0:
                cluster_means.append((c, features_df.loc[mask, "mean_gp"].mean()))
            else:
                cluster_means.append((c, 0))
        order = sorted(cluster_means, key=lambda x: -x[1])
        order_map = {orig: rank for rank, (orig, _) in enumerate(order)}

        features_df = features_df.copy()
        features_df["difficulty_cluster"] = clusters
        features_df["difficulty_label"] = [self.labels[order_map[c]] for c in clusters]
        features_df["difficulty_score"] = [round(order_map[c] / 4, 2) for c in clusters]

        return features_df

    def save(self, path="models/trained/model1_indonesia.joblib"):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": self.model, "scaler": self.scaler}, path)

    @classmethod
    def load(cls, path="models/trained/model1_indonesia.joblib"):
        data = joblib.load(path)
        instance = cls()
        instance.model = data["model"]
        instance.scaler = data["scaler"]
        return instance


class GradeOutcomePredictor:
    """Model 2: Logistic Regression (softmax) for grade prediction."""

    def __init__(self, random_state=42):
        self.random_state = random_state
        self.model = None
        self.scaler = None

    def fit(self, features_df):
        """Train Logistic Regression on student×course features."""
        feature_cols = ["difficulty_score", "ipk_before", "ips_last_semester",
                        "ips_trend", "total_sks_completed", "course_sks",
                        "semester_number", "mean_ips_takers", "pct_a_or_above",
                        "pct_below_b"]

        X = features_df[feature_cols].values
        # Convert grade to class index
        y = features_df["grade"].apply(lambda g: GRADE_ORDER.index(g) if g in GRADE_ORDER else 9).values

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        self.model = LogisticRegression(max_iter=1000, solver="lbfgs",
                                        C=1.0, random_state=self.random_state)
        self.model.fit(X_scaled, y)

    def predict_grade_distribution(self, course_row):
        """Predict probability distribution over 10 grade classes."""
        X = self.scaler.transform(course_row.reshape(1, -1))
        proba = self.model.predict_proba(X)[0]
        return {GRADE_ORDER[int(cls)]: float(p) for cls, p in
                zip(self.model.classes_, proba)}

    def save(self, path="models/trained/model2_indonesia.joblib"):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": self.model, "scaler": self.scaler}, path)

    @classmethod
    def load(cls, path="models/trained/model2_indonesia.joblib"):
        data = joblib.load(path)
        instance = cls()
        instance.model = data["model"]
        instance.scaler = data["scaler"]
        return instance
