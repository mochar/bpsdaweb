var binsets = {};

$(function() {
    createChord();
    Sijax.request('bin_data');

    $('.colpicker').colpick({
        layout: 'hex',
        submit: 0,
        colorScheme: 'dark',
        onChange: function(hsb, hex, rgb, el, bySetColor) {
            $(el).css('background-color', '#' + hex);

            if(!bySetColor) $(el).val(hex);
        },
        onHide: function() {
        }
    }).keyup(function() {
        $(this).colpickSetColor(this.value);
    });
});


function to_matrix(bins) {
    var matrix = bins.map(function(bin1, i) {
        var matching = bins.map(function(bin2) {
            if (bin1 === bin2) return 0;
            return bin1.contigs.filter(function(c) {
                return bin2.contigs.indexOf(c) > -1;
            }).length;
        });
        var sum = 0;
        for (var j = 0; j < matching.length; j++) {
            sum += matching[j];
        }
        matching[i] = bin1.contigs.length - sum;
        return matching;
    });
    return matrix;
}

function findBinset(binsetName) {
    for (var i = 0; i < binsets.length; i++) {
        if (binsets[i].binset === binsetName) return binsets[i];
    }
}

function changeAndUpdateChord(binset1, binset2) {
    var bins = findBinset(binset1).bins.concat(findBinset(binset2).bins);
    bins = bins.filter(function(bin) { return bin.status === 'visible'; });
    var matrix = to_matrix(bins);
    updateChord(matrix, bins.map(function(b) { return b.color; }));
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
