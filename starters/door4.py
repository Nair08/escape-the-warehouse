fin = open('inventory.csv', 'r')
fout = open('reorder_list.txt', 'w')
print('sku', 'item', 'qty_to_order', sep=',', file=fout)   # header line

# TODO: read each inventory line and write one line for each low-stock item

fin.close()
fout.close()
