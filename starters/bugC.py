team = ['Ava', 'Ben', 'Carmen']
for name in team:
    fout = open('team.txt', 'w')
    print(name, file=fout)
    fout.close()
