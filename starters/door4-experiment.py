fs = open('scratch.txt', 'a')
print('Hello from', 'append mode', file=fs)
fs.close()
