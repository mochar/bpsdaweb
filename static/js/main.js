var binsets = {};

$(function() {
    createChord();
    Sijax.request('bin_data');

    $('#picker').colpick({
        layout: 'hex'
    });
});


function setBinsetInfo(id, binset) {
    var binsetBins = bins.filter(function(b) { return b.binset === binset });
    var panel = $('#binset' + id + 'Panel');
}

function activeBinsetBins() {
    var bins = [];
    binsets.forEach(function(binset) {
        if (binset.active) {
            binset.bins.forEach(function(bin) {
                if (bin.status === "visible") bins.push(bin);
            });
        }
    });
    return bins;
}

function to_matrix(bins) {
    var matrix = bins.map(function(bin1, i) {
        var matching = bins.map(function(bin2) {
            if (bin1 == bin2) return 0;
            var bin2Contigs = bin2.contigs.map(function(c) { return c.name; });
            return bin1.contigs.filter(function(c) {
                return bin2Contigs.indexOf(c.name) > -1;
            }).length;
        });
        var sum = 0;
        for (var j = 0; j < matching.length; j++) {
            sum += matching[i];
        }
        //matching[i] = bin1.contigs.length - sum;
        return matching;
    });
    return matrix;
}

function findBinset(binsetName) {
    for (var i = 0; i < binsets.length; i++) {
        if (binsets[i].binset === binsetName) return binsets[i];
    }
}

// Toggles bin.status values "hidden" and "visible"
function toggleBin(binsetName, binName) {
    var binset = findBinset(binsetName);
    for (var i = 0; i < binset.bins.length; i++) {
        if (binset.bins[i].name === binName) {
            if (binset.bins[i].status === 'visible') {
                binset.bins[i].status = 'hidden';
            } else {
                binset.bins[i].status = 'visible';
            }
            return;
        }
    }
}
