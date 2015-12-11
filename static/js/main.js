$(function() {
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
        var matching = bins.map(function(bin2, j) {
            if (i === j) return 0;
            return bin1.contigs.filter(function(c) {
                return bin2.contigs.indexOf(c) > -1;
            }).length;
        });
        var sum = 0;
        for (var i = 0; i < matching.length; i++) {
            sum += matching[i];
        }
        matching[i] = bin1.contigs.length - sum;
        return matching;
    });
    return matrix;
}
