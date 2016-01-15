import csv


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
    return sorted(bins, key=gc_content_bin, reverse=reverse)


def gc_content_bin(bin):
    gc, atcg = .0, .0
    for contig in bin.contigs:
        if contig.sequence is None:
            continue
        gc += contig.sequence.lower().count('g')
        gc += contig.sequence.lower().count('c')
        atcg += len(contig.sequence)
    return float('{0:.3f}'.format(gc / atcg)) if atcg else 0


def n50(bin):
    lengths = sorted([int(c.length) for c in bin.contigs])
    half = sum(lengths) / 2.
    total = 0
    for length in lengths:
        total += length
        if total >= half:
            return length


def parse_fasta(fasta_file):
    with open(fasta_file) as f:
        header, sequence = '', ''
        for line in f:
            line = line.rstrip()
            if line.startswith('>'):
                if header:
                    yield header, sequence
                header = line.lstrip('>')
                sequence = ''
            else:
                sequence += line
        yield header, sequence


def gc_content(sequence):
    gc = sequence.lower().count('g') + sequence.lower().count('c')
    return float('{0:.3f}'.format(gc / len(sequence)))


def parse_dsv(dsv_file, delimiter=None):
    try:
        dsv_file_contents = dsv_file.read()
    except AttributeError:
        with open(dsv_file, 'r') as f:
            dsv_file_contents = f.read()
    if delimiter is None:
        delimiter = csv.Sniffer().sniff(dsv_file_contents).delimiter
    for line in dsv_file_contents.splitlines():
        if line == '': continue
        yield line.rstrip().split(delimiter)


def is_number(string):
    try:
        float(string)
        return True
    except ValueError:
        return False
