f = open('orders_log.txt', 'r')
count_d = 0
for line in f:
    if line == 'END':
        break
    count_d += 1
f.close()
print(count_d)
