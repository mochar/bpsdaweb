ko.bindingHandlers.chordSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var width = 500, height = 500,
            svg = d3.select(element).append("svg")
                .attr("width", width)
                .attr("height", height)
                .append("g")
                .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

        svg.append("g").attr("id", "group");
        svg.append("g").attr("id", "chord");
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var matrix = bindingContext.$data.matrix();
        var unifiedColor = bindingContext.$data.unifiedColor();
        var bins = bindingContext.$data.bins;

        var width = 500, height = 500,
            innerRadius = Math.min(width, height) * .41,
            outerRadius = innerRadius * 1.1,
            chord = d3.layout.chord().padding(.05).matrix(matrix),
            svg = d3.select(element);

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
            .style("stroke", '#000000')
            .style('opacity', 0)
            .on("mouseover", fade(.1))
            .on("mouseout", fade(1))
            .on('click', function(d) {
                bindingContext.$data.selectedBin(bins[d.index]);
        });

        groupPaths.transition()
            .style("fill", function(d) {
                var bin = bins[d.index];
                return unifiedColor ? bin.binsetColor : bin.color;
            })
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

        chordPaths.transition()
            .style("fill", function(d) {
                var bin = bins[d.source.index];
                return unifiedColor ? bin.binsetColor : bin.color;
            })
            .style('opacity', 1)
            .attr("d", d3.svg.chord().radius(innerRadius));

        chordPaths.exit()
            .transition()
            .remove();
    }
};
