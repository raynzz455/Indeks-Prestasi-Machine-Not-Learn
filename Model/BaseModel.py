"""
Base model class — shared interface for all ML models in the project.

All models (CourseDifficultyClusterer, GradeOutcomePredictor, etc.)
inherit from this base class to ensure consistent save/load behavior.
"""

from pathlib import Path
import joblib


class BaseModel:
    """Base class for all ML models in the IPK Optimizer pipeline."""

    model_type = "base"
    model = None
    scaler = None

    def fit(self, X, y=None):
        """Train the model on input data."""
        raise NotImplementedError("Subclasses must implement fit()")

    def predict(self, X):
        """Make predictions on input data."""
        raise NotImplementedError("Subclasses must implement predict()")

    def evaluate(self, X_test, y_test=None):
        """Evaluate model performance on test data."""
        raise NotImplementedError("Subclasses must implement evaluate()")

    def save(self, path):
        """Serialize model to disk using joblib."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({
            "model": self.model,
            "scaler": self.scaler,
            "model_type": self.model_type,
        }, path)
        print(f"✅ Model saved: {path}")

    @classmethod
    def load(cls, path):
        """Load model from disk."""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Model not found: {path}")
        data = joblib.load(path)
        instance = cls()
        instance.model = data.get("model")
        instance.scaler = data.get("scaler")
        instance.model_type = data.get("model_type", cls.model_type)
        print(f"✅ Model loaded: {path}")
        return instance

    def get_metrics(self):
        """Return model evaluation metrics."""
        return {"model_type": self.model_type}
