import os
import pandas as pd
import sqlalchemy

class DataLoader:
    def __init__(self):
        self.source = os.getenv("DATA_SOURCE")
        self.db_url = os.getenv("DB_URL")
        self.file_path = os.getenv("DATA_PATH")

    def load(self):

        # Explicit mode
        if self.source == "db":
            print("📡 Using DATABASE as source")
            return self._load_db()


        elif self.source == "file":
            print("📁 Using FILE as source")
            return self._load_file()
        
        # Auto mode (fallback)
        else:
            print("⚠️ No DATA_SOURCE set → fallback mode")

            if self.db_url:
                try:
                    print("📡 Trying DATABASE...")
                    return self._load_db()
                except Exception as e:
                    print(f"❌ DB failed: {e}")
                    print("➡️ Fallback to FILE")

            return self._load_file()

    def _load_db(self):
        print("🔌 Connecting to DB...")
        engine = sqlalchemy.create_engine(self.db_url)

        df = pd.read_sql("SELECT * FROM student_grades", engine)

        print("✅ DB Load Success")
        self._debug_df(df)
        return df

    def _load_file(self):
        print(f"📂 Loading file: {self.file_path}")

        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"{self.file_path} not found")

        if self.file_path.endswith(".csv"):
            df = pd.read_csv(self.file_path)

        elif self.file_path.endswith(".xlsx"):
            df = pd.read_excel(self.file_path)

        else:
            raise ValueError("Unsupported file format")

        print("✅ File Load Success")
        self._debug_df(df)
        return df
    
    # Debug Helper
    def _debug_df(self, df):
        print("\n📊 Data Preview:")
        print(df.head())

        print("\n📐 Shape:", df.shape)

        print("\n📎 Columns:", list(df.columns))

        print("\n⚠️ Missing Values:")
        print(df.isnull().sum())
            
            