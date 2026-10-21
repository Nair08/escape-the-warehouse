f = open('shipment_weights.txt', 'r')
total_while = 0
line = f.readline()
while ...:                          # TODO: keep going while there are more lines
    line = line.rstrip('\n').strip()
    if line != '':                  # skip blank lines
        total_while += ...          # TODO: add this line's weight (it's a string!)
    line = ...                      # TODO: read the next line
f.close()
print('Total (while):', total_while)
