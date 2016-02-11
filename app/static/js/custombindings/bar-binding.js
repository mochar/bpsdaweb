ko.bindingHandlers.barSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var margin = {top: 40, right: 60, bottom: 20, left: 60},
            //width = 300 - margin.left - margin.right,
            width = $(element).width() - margin.left - margin.right,
            height = 350 - margin.top - margin.bottom;

        var svg = d3.select(element).append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
          .append('g')
            .attr('class', 'graph')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0,' + height + ')')
          .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-65)' );

        svg.append('g')
            .attr('class', 'y axis axisLeft')
            .attr('transform', 'translate(0,0)')
          .append('text')
            .attr('y', 6)
            .attr('dy', '-2em')
            .attr('dx', '3em')
            .style('text-anchor', 'end')
            .text('Completeness');

        svg.append('g')
            .attr('class', 'y axis axisRight')
            .attr('transform', 'translate(' + (width) + ',0)')
          .append('text')
            .attr('y', 6)
            .attr('dy', '-2em')
            .attr('dx', '3em')
            .style('text-anchor', 'end')
            .text('Contamination');
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        console.log('Update barplot');
        var margin = {top: 40, right: 60, bottom: 20, left: 60},
            //width = 300 - margin.left - margin.right,
            width = $(element).width() - margin.left - margin.right,
            height = 350 - margin.top - margin.bottom,
            svg = d3.select(element).select('g');

        var bins = ko.unwrap(valueAccessor());

        var xValue = 'name',
            yValue1 = 'completeness',
            yValue2 = 'contamination';

        var x = d3.scale.ordinal().rangeRoundBands([0, width], .1),
            y0 = d3.scale.linear().domain([0, 100]).range([height, 0]),
            y1 = d3.scale.linear().domain([0, 100]).range([height, 0]);


        var xAxis = d3.svg.axis().scale(x).orient('bottom');
        var yAxisLeft = d3.svg.axis().scale(y0).ticks(4).orient('left');
        var yAxisRight = d3.svg.axis().scale(y1).ticks(6).orient('right');

        x.domain(bins.map(function(d) { return d[xValue]; }));
        y0.domain([0, d3.max(bins, function(d) { return d[yValue1]; })]);

        svg.select('.x').call(xAxis);
        svg.select('.axisLeft').call(yAxisLeft);
        svg.select('.axisRight').call(yAxisRight);

        var bars = svg.selectAll('.rects')
            .data(bins, function(d) { return d.id; });

        bars.enter().append('g').attr('class', 'rects');
        bars.append('rect')
            .attr('class', 'bar1')
            .attr('x', function(d) { return x(d[xValue]); })
            .attr('width', x.rangeBand() / 2)
            .attr('y', function(d) { return y0(d[yValue1]); })
            .attr('height', function(d) { return height - y0(d[yValue1]); });
        bars.append('rect')
            .attr('class', 'bar2')
            .attr('x', function(d) { return x(d[xValue]) + x.rangeBand() / 2; })
            .attr('width', x.rangeBand() / 2)
            .attr('y', function(d) { return y1(d[yValue2]); })
            .attr('height', function(d) { return height - y1(d[yValue2]); });

        bars.exit().remove();
    }
};
