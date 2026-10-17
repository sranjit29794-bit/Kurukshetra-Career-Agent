import sqlite3
import sys

def print_counts():
    conn = sqlite3.connect("devproof.db")
    cur = conn.cursor()
    tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;").fetchall()
    print("=== SQLite Database Table Counts (devproof.db) ===")
    for (t,) in tables:
        count = cur.execute(f"SELECT COUNT(*) FROM \"{t}\";").fetchone()[0]
        print(f"  {t:20}: {count}")
    conn.close()

if __name__ == "__main__":
    print_counts()
