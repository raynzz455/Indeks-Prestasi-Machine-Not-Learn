"""
Preprocessing module — data cleaning & transformation.

This module handles:
- Missing value imputation
- Outlier detection (grades outside 0-4 range)
- Encoding categorical variables (major, scenario)
- Normalization of course names (fuzzy matching)

Status: IMPLEMENTED in TypeScript (src/lib/gpa/course-normalizer.ts)
        This Python version is a stub for the original pipeline structure.

TODO: Port TypeScript course normalizer to Python when needed.
"""

import pandas as pd
import numpy as np


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean and transform raw transcript data.

    Args:
        df: Raw DataFrame with columns (student_id, jurusan, semester_ke,
            mata_kuliah, sks, nilai, bobot_nilai)

    Returns:
        Cleaned DataFrame with normalized column names and values.
    """
    # Rename Indonesian columns to pipeline format
    rename_map = {
        "jurusan": "major",
        "semester_ke": "semester_number",
        "mata_kuliah": "course_name",
        "nilai": "grade",
        "bobot_nilai": "grade_point",
        "kemampuan_laten": "latent_ability",
    }
    df = df.rename(columns=rename_map)

    # Handle missing values
    df = df.dropna(subset=["course_name", "sks", "grade"])

    # Clip grade points to valid range [0, 4]
    df["grade_point"] = df["grade_point"].clip(0, 4)

    # Clip SKS to valid range [1, 8]
    df["sks"] = df["sks"].clip(1, 8)

    # Clip semester to valid range [1, 14]
    df["semester_number"] = df["semester_number"].clip(1, 14)

    return df


def encode_major(df: pd.DataFrame) -> pd.DataFrame:
    """Encode major as integer for ML models."""
    majors = df["major"].unique()
    major_map = {m: i for i, m in enumerate(majors)}
    df["major_encoded"] = df["major"].map(major_map)
    return df, major_map
