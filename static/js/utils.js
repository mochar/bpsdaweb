function to_matrix(binsets) {
    var bins_ = bins.filter(function(b) {
        return binsets.indexOf(b.binset) > -1;
    });
    var matrix = bins_.map(function(bin1, i) {
        var matching = bins_.map(function(bin2) {
            if (bin1 == bin2) return 0;
            return bin1.contigs.filter(function(c) {
                return bin2.contigs.indexOf(c) > -1;
            }).length;
        });
        var sum = 0;
        for (var j = 0; j < matching.length; j++) {
            sum += matching[j];
        }
        matching[i] = bin1.contigs.length - sum;
        console.log(matching);
        return matching;
    });
    return matrix;
}