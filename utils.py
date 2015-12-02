def to_matrix(bins1, bins2):
    matrix = []
    for bin1 in bins1:
        matching = [0 for _ in bins1]
        for bin2 in bins2:
            matching.append(len([c for c in bin1.contigs
                                 if c in bin2.contigs]))
        matrix.append(matching)
    for bin2 in bins2:
        matching = []
        for bin1 in bins1:
            matching.append(len([c for c in bin2.contigs
                                 if c in bin1.contigs]))
        matching.extend([0 for _ in bins2])
        matrix.append(matching)

    return matrix


def parse_fasta(fasta_file):
    header, sequence = '', ''
    for line in fasta_file:
        line = line.decode('utf-8').rstrip()
        if line.startswith('>'):
            if header:
                yield header, sequence
            header = line.lstrip('>')
            sequence = ''
        else:
            sequence += line
    yield header, sequence
