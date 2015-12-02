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


def sort_bins(bins, reverse=False):
    def gc_content(bin):
        gc, atcg = .0, .0
        for contig in bin.contigs:
            gc += contig.sequence.lower().count('g')
            gc += contig.sequence.lower().count('c')
            atcg += len(contig.sequence)
        return gc / atcg
    return sorted(bins, key=gc_content, reverse=reverse)


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
