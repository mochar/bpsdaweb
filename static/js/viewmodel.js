ko.bindingHandlers.chordSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        createChord(element);
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        console.log("Update chord panel");
        var selectedBinsets = bindingContext.$data.selectedBinsets();
        if (selectedBinsets.length !== 2) return;
        console.log(selectedBinsets);
        $.getJSON('/binsets/' + selectedBinsets[0].name(), function(binset1) {
            $.getJSON('/binsets/' + selectedBinsets[1].name(), function(binset2) {
                var bins = binset1.concat(binset2);
                var matrix = to_matrix(bins);
                updateChord(element, matrix, bins.map(function(b) { return b.color; }));
            });
        });
    }
};


function Binset(data) {
    var self = this;
    self.name = ko.observable(data.name);
    self.color = ko.observable(data.color);
    self.bins = ko.observableArray(data.bins);
}

function ChordPanel() {
    var self = this;
    self.template = "chord";
    self.firstSelectedBinset = ko.observable();
    self.secondSelectedBinset = ko.observable();
    self.selectedBinsets = ko.observableArray();

    self.switchSelectedBinsets = function() {
        var tmp = self.firstSelectedBinset();
        self.firstSelectedBinset(self.secondSelectedBinset());
        self.secondSelectedBinset(tmp);
    };

    self.updateChordPanel = function() {
        self.selectedBinsets([self.firstSelectedBinset(),
                              self.secondSelectedBinset()]);
    };
}

function ViewModel() {
    var self = this;
    self.binsets = ko.observableArray([]);

    // Panels
    self.panels = ko.observableArray([new ChordPanel()]);
    self.getPanelTemplate = function(panel) {
        return panel.template;
    };

    function getBinsetFromName(binsetName) {
        return ko.utils.arrayFilter(self.binsets(), function(bs) {
            return bs.name === binsetName;
        })[0];
    }

    $.getJSON('/binsets', function(data) {
        var binsets = $.map(data, function(binset) { return new Binset(binset) });
        self.binsets(binsets);
        console.log('viewmodel done');
    });
}

$(function() {
    ko.applyBindings(new ViewModel());
});
