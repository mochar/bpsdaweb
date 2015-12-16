// --- Chord
var width = 500, height = 500;
var innerRadius = Math.min(width, height) * .41;
var outerRadius = innerRadius * 1.1;

function createChord(element) {
    var svg = d3.select(element).append("svg")
        .attr("width", width)
        .attr("height", height)
      .append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    svg.append("g").attr("id", "group");
    svg.append("g").attr("id", "chord");
}

function updateChord(element, matrix, bins, unifiedColor) {
    var chord = d3.layout.chord().padding(.05).matrix(matrix);
    var svg = d3.select(element);

    function fade(opacity) {
        return function(g, i) {
            svg.selectAll("#chord path")
                .filter(function(d) { return d.source.index != i && d.target.index != i; })
                .transition()
                .style("opacity", opacity);
        };
    }

    // Update groups
    var groupPaths = svg.select('#group').selectAll('path')
        .data(chord.groups(), function(d) { return d.index; });

    groupPaths.enter().append("path")
        .style("stroke", function(d) { return '#000000'; })
        .style('opacity', 0)
        .on("mouseover", fade(.1))
        .on("mouseout", fade(1));

    groupPaths
        .style("fill", function(d) {
            var bin = bins[d.index];
            return unifiedColor ? bin.binsetColor : bin.color;
        })
      .transition()
        .style('opacity', 1)
        .attr("d", d3.svg.arc().innerRadius(innerRadius).outerRadius(outerRadius));

    groupPaths.exit()
        .transition()
        .remove();

    // Update chords
    var chordPaths = svg.select('#chord').selectAll('path')
        .data(chord.chords(), function(d) {
            if (d.source.index < d.target.index)
                return d.source.index + "-" + d.target.index;
            return d.target.index + "-" + d.source.index;
        });

    chordPaths.enter()
      .append("path")
        .style("opacity", 0);

    chordPaths
        .style("fill", function(d) {
            var bin = bins[d.source.index];
            return unifiedColor ? bin.binsetColor : bin.color;
        })
      .transition()
        .style('opacity', 1)
        .attr("d", d3.svg.chord().radius(innerRadius));

    chordPaths.exit()
        .transition()
        .remove();
}
