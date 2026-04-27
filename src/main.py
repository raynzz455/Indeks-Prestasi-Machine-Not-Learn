from data_loader import DataLoader
from dotenv import load_dotenv
load_dotenv()
def main():
    loader = DataLoader()
    df = loader.load()

if __name__ == "__main__":
    main()