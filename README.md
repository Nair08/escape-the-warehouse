# Escape the Warehouse

A Chapter 7 (files and exceptions) practice escape room for Python. Students read, parse and write
text files to escape the Riverbend Supply Co. warehouse. Python runs in the browser with
[Pyodide](https://pyodide.org), so there is nothing to install and no server.

- `index.html` is the game. Progress is saved in the browser's localStorage.
- `py/warehouse.py` holds the data files, the door checks and the hints. Answers are stored as salted SHA-256 hashes.
- `starters/` holds the starter code for each editor.

## Run it locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000/. (Opening `index.html` straight from disk won't work, because the
page loads its Python and starter files over HTTP.)
