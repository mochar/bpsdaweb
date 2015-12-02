def to_matrix(bins):
    matrix = []
    for i, bin1 in enumerate(bins):
        matching = []
        for bin2 in bins:
            if bin1 == bin2:
                matching.append(0)
            else:
                matching.append(len([c for c in bin1.contigs
                                     if c in bin2.contigs]))
        matching[i] = len(bin1.contigs) - sum(matching)
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
