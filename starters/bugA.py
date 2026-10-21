f = open('temps.txt', 'r')
total = 0
n = 0
for line in f:
    value = float(line.rstrip('\n'))
    total += value
    n += 1
f.close()
avg_a = total / n
print(avg_a)
