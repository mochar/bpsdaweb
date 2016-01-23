ko.bindingHandlers.histSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var margin = {top: 10, right: 30, bottom: 50, left: 30},
            width = $(element).width() - margin.left - margin.right,
            //width = 450 - margin.left - margin.right,
            height = 300 - margin.top - margin.bottom,
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
        var dirty = bindingContext.$data.plotContigsDirty();
        if (!dirty) return;
        bindingContext.$data.plotContigsDirty(false);

        var plotData = ko.unwrap(valueAccessor());
        var contigs = bindingContext.$data.plotContigs.map(function(contig) {
            return contig[plotData];
        });
        if (contigs.length == 0) return;

        var margin = {top: 10, right: 30, bottom: 50, left: 30},
            width = $(element).width() - margin.left - margin.right,
            //width = 300 - margin.left - margin.right,
            height = 300 - margin.top - margin.bottom,
            svg = d3.select(element).select('svg').attr('width', width).select("g");

        var xMin = d3.min(contigs) - 1,
            xMax = d3.max(contigs) + 1;

        var x = d3.scale.linear().domain([xMin, xMax]).range([0, width]);

        var data = d3.layout.histogram()
            .bins(x.ticks())
            (contigs);

        bindingContext.$data.plotContigs = [];

        var y = d3.scale.linear()
            .domain([0, d3.max(data, function(d) { return d.y; })])
            .range([height, 0]);

        // Update x axis
        var xAxis = d3.svg.axis().scale(x).orient('bottom');
        svg.select('.x').call(xAxis).selectAll('text')
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr('transform', 'rotate(-65)')
            .style('text-anchor', 'end');

        var bar = svg.selectAll('.bar').data(data);
        bar.remove();
        bar.enter().append('g')
            .attr('class', 'bar')
            .attr('transform', function(d) {
                return 'translate(' + x(d.x) + ',' + y(d.y) + ')';
            });

        bar.append('rect')
            .attr('x', 1)
            .attr('width', x(data[0].dx) - 1)
          .transition()
            .attr('height', function(d) { return height - y(d.y); });

        bar.append('text')
            .attr('dy', '.75em')
            .attr('y', 6)
            .attr('x', x(data[0].dx) / 2)
            .attr('text-anchor', 'middle')
            .text(function(d) { return d.y; });
    }
};
