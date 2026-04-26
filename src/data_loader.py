import pandas as pd

def load_data(path: str) -> pd.DataFrame:
    """
    Load dataset dari CSV
    """
    df = pd.read_csv(path)
    return df