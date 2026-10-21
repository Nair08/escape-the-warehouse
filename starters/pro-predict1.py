with open('scratch2.txt', 'w') as f:
    f.write('Line one')
    f.write('Line two')

with open('scratch2.txt', 'r') as f:
    print(repr(f.read()))
