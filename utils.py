def to_matrix(binset1, binset2):
    matrix = []
    for bin1 in binset1.bins.all():
        matching = [0 for _ in binset1.bins.all()]
        for bin2 in binset2.bins.all():
            matching.append(len([c for c in bin1.contigs
                                 if c in bin2.contigs]))
        matrix.append(matching)
    for bin2 in binset2.bins.all():
        matching = []
        for bin1 in binset1.bins.all():
            matching.append(len([c for c in bin2.contigs
                                 if c in bin1.contigs]))
        matching.extend([0 for _ in binset2.bins.all()])
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
