ko.bindingHandlers.histSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var margin = {top: 1, right: 3, bottom: 3, left: 3},
            width = 300 - margin.left - margin.right,
            height = 150 - margin.top - margin.bottom,
            svg = d3.select(element).append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," +
                    margin.top + ")");

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")");
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var contigs = bindingContext.$data.contigs();

        var margin = {top: 1, right: 3, bottom: 3, left: 3},
            width = 300 - margin.left - margin.right,
            height = 150 - margin.top - margin.bottom,
            color = 'steelblue',
            svg = d3.select(element).select("g");

        var xMin = d3.min(contigs, function(d) { return d.gc; }),
            xMax = d3.max(contigs, function(d) { return d.gc; });

        var x = d3.scale.linear().domain([xMin, xMax]).range([0, width]);

        var data = d3.layout.histogram()
            .value(function(d) { return d.gc; })
            .bins(x.ticks(12));

        var histData = data(contigs);

        var y = d3.scale.linear()
            .domain([0, d3.max(histData, function(d) { return d.y; })])
            .range([height, 0]);

        // Update x axis
        var xAxis = d3.svg.axis().scale(x).orient('bottom');
        svg.select('.x .axis').call(xAxis);

        // update
        var bar = svg.selectAll('.bar').data(histData);

        bar.exit().remove();

        bar.enter().append('g')
            .attr('class', 'bar')
            .attr('transform', function(d) {
                return 'translate(' + x(d.x) + ',' + y(d.y) + ')';
            });

        var active = false;
        var activeBar;

        bar.append('rect')
            .attr('x', 5)
            .attr('width', (35))
            .attr('height', function(d) { return height - y(d.y); })
            .on('click', function(d) {

            });

        bar.append('text')
            .attr('class', 'barText')
            .attr('dy', '.75em')
            .attr('y', 6)
            .attr('x', (35) / 1.60)
            .attr('text-anchor', 'middle')
            .text(function(d) { return d.y; });
    }
};
