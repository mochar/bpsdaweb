ko.bindingHandlers.chordSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        createChord(element);
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        console.log("Update chord panel");
        var selectedBinsets = bindingContext.$data.selectedBinsets();
        if (selectedBinsets.length !== 2) return;
        var unifiedColor = bindingContext.$data.unifiedColor();
        $.getJSON('/binsets/' + selectedBinsets[0].name(), function(binset1) {
            $.getJSON('/binsets/' + selectedBinsets[1].name(), function(binset2) {
                var bins = binset1.concat(binset2.reverse());
                var matrix = to_matrix(bins);
                if (unifiedColor) {
                    var color = binset1.map(function() { return selectedBinsets[0].color(); });
                    color = color.concat(binset2.map(function() { return selectedBinsets[1].color(); }));
                } else {
                    var color = bins.map(function(b) { return b.color });
                }
                updateChord(element, matrix, color);
            });
        });
    }
};

function Binset(data) {
    var self = this;
    self.name = ko.observable(data.name);
    self.color = ko.observable(data.color);
    self.bins = ko.observableArray(data.bins);
    self.editingName = ko.observable(false);

    self.editName = function() { self.editingName(true); }
}

function BinsetPanel(binset) {
    var self = this;
    self.template = "binsetPanel";
    self.binset = ko.observable(binset);
}

function ChordPanel() {
    var self = this;
    self.template = "chordPanel";
    self.firstSelectedBinset = ko.observable();
    self.secondSelectedBinset = ko.observable();
    self.selectedBinsets = ko.observableArray();
    self.unifiedColor = ko.observable(false);

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
    self.contigsets = ko.observableArray([]);

    // Panels
    self.panels = ko.observableArray([new ChordPanel(), new BinsetPanel("kek")]);
    self.getPanelTemplate = function(panel) {
        return panel.template;
    };
    self.removePanel = function(panel) {
        self.panels.remove(panel);
    };

    self.removeBinset = function(binset) {
        self.binsets.remove(binset);
    };

    $.getJSON('/binsets', function(data) {
        var binsets = $.map(data, function(binset) { return new Binset(binset) });
        self.binsets(binsets);
        console.log('viewmodel: got binsets');
    });

    $.getJSON('/contigsets', function(data) {
        self.contigsets(data);
        console.log('viewmodel: got contigsets');
    });
}

$(function() {
    ko.applyBindings(new ViewModel());
});
