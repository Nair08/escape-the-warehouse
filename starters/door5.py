filenames = ['sales_mon.txt', 'sales_tue.txt', 'sales_wed.txt', 'sales_thu.txt', 'sales_fri.txt']
week_total = 0
missing_files = []
bad_lines = 0

for name in filenames:
    # TODO: try to open the file; if it's missing, add its name to missing_files
    # TODO: for each line: skip blanks, add valid numbers to week_total,
    #       and count lines that can't be converted in bad_lines
    ...

print('Week total:', round(week_total, 2))
print('Missing files:', missing_files)
print('Corrupted lines:', bad_lines)
