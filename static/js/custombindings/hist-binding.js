ko.bindingHandlers.histSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var margin = {top: 10, right: 30, bottom: 30, left: 30},
            width = 300 - margin.left - margin.right,
            height = 200 - margin.top - margin.bottom,
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
        var contigs = bindingContext.$data.plotContigs();

        var margin = {top: 10, right: 30, bottom: 30, left: 30},
            width = 300 - margin.left - margin.right,
            height = 200 - margin.top - margin.bottom,
            svg = d3.select(element).select("g");

        var xMin = d3.min(contigs),
            xMax = d3.max(contigs);

        var x = d3.scale.linear().domain([xMin, xMax]).range([0, width]);

        var data = d3.layout.histogram()
            .bins(x.ticks(12));

        var histData = data(contigs);
        bindingContext.$data.plotContigs([]);

        var y = d3.scale.linear()
            .domain([0, d3.max(histData, function(d) { return d.y; })])
            .range([height, 0]);

        // Update x axis
        var xAxis = d3.svg.axis().scale(x).orient('bottom');
        svg.select('.x').call(xAxis);

        // update
        var bar = svg.selectAll('.bar').data(histData);

        var exiting = bar.exit();
        exiting.select('rect')
            .transition()
            .attr('height', 0);
        exiting.remove();

        var barG = bar.enter().append('g')
            .attr('class', 'bar')
            .attr('transform', function(d) {
                return 'translate(' + x(d.x) + ',' + y(d.y) + ')';
            });
        barG.append('rect')
            .attr('x', 5)
            .attr('width', 35)
            //.attr('height', function(d) { return y(d.y); })
            .attr('height', function(d) { return y(height); })
            .on('click', function(d) {});
        barG.append('text')
            .attr('class', 'barText')
            .attr('dy', '.75em')
            .attr('y', 6)
            .attr('x', 35 / 1.60)
            .attr('text-anchor', 'middle')
            .text(function(d) { return d.y; });
        barG.select('rect').transition()
            .attr('height', function(d) { return height - y(d.y); })
    }
};
