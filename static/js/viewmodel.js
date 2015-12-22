ko.bindingHandlers.chordSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        createChord(element);
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        console.log("Update chord panel");
        var matrix = bindingContext.$data.matrix();
        var unifiedColor = bindingContext.$data.unifiedColor();
        var bins = bindingContext.$data.bins;

        updateChord(element, matrix, bins, unifiedColor);
        d3.select(element).selectAll('#group path')
            .on('click', function(d) {
                bindingContext.$data.selectedBin(bins[d.index]);
            });
    }
};

ko.extenders.trackChange = function(target, track) {
    if (track) {
        target.isDirty = ko.observable(false);
        target.originalValue = target();
        target.subscribe(function(newValue) {
            target.isDirty(newValue != target.originalValue);
        })
    }
    return target;
};

function BinsetPanel(binset) {
    var self = this;
    self.template = "binsetPanel";
    self.binset = ko.observable(binset);
}

function ContigsPanel() {
    var self = this;
    self.template = "contigsPanel";
    self.selectedContigsets = ko.observableArray([]);
}

function ChordPanel() {
    var self = this;
    self.template = "chordPanel";
    self.selectedBinset1 = ko.observable(null).extend({trackChange: true});
    self.selectedBinset2 = ko.observable(null).extend({trackChange: true});
    self.selectedBin = ko.observable('test');
    self.showSettings = ko.observable(false);

    self.unifiedColor = ko.observable(false);
    self.matrix = ko.observable([]);
    self.bins = [];

    self.switchSelectedBinsets = function() {
        var tmp = self.selectedBinset1();
        self.selectedBinset1(self.selectedBinset2());
        self.selectedBinset2(tmp);
    };

    self.toggleSettings = function() {
        self.showSettings(!self.showSettings());
    };

    self.updateChordPanel = function() {
        if (self.selectedBinset1.isDirty() || self.selectedBinset2.isDirty()) {
            console.log('Dirty');
            var binsets = [self.selectedBinset1(), self.selectedBinset2()];
            var binIds = binsets[0].bins().concat(binsets[1].bins());
            var data = {bins: binIds.join(',')};
            $.when(
                $.getJSON('/to_matrix', data),
                $.getJSON('/binsets/' + binsets[0].id, data),
                $.getJSON('/binsets/' + binsets[1].id, data)
            ).done(function(matrix, bins1, bins2) {
                bins1[0].forEach(function(b) {
                    $.extend(b, {binsetColor: binsets[0].color()});
                });
                bins2[0].forEach(function(b) {
                    $.extend(b, {binsetColor: binsets[1].color()});
                });
                self.bins = bins1[0].concat(bins2[0].reverse());
                self.matrix(matrix[0]);
            });
        }
    };
}

function Binset(data) {
    var self = this;
    self.id = data.id;
    self.contigset = data.contigset;
    self.name = ko.observable(data.name);
    self.color = ko.observable(data.color);
    self.bins = ko.observableArray(data.bins);
    self.editingName = ko.observable(false);

    self.editName = function() { self.editingName(true); }
}

function Contigset(data) {
    var self = this;
    self.id = data.id;
    self.name = ko.observable(data.name);
    self.contigs = ko.observableArray(data.contigs);
    self.binsets = ko.observableArray(data.binsets);
}

function ViewModel() {
    var self = this;
    self.binsets = ko.observableArray([]);
    self.contigsets = ko.observableArray([]);
    self.selectedContigset = ko.observable(null);
    self.contigs = ko.observableArray([]);

    // The binsets of the selected contigset
    self.contigsetBinsets = ko.computed(function() {
        var contigset = self.selectedContigset();
        var binsets = self.binsets();
        if (!contigset) return [];
        return ko.utils.arrayFilter(binsets, function(binset) {
            return binset.contigset === contigset.id;
        })
    });

    ko.computed(function() {
        var contigset = self.selectedContigset();
        if (!contigset) return;
        var data = {items: 50};
        $.getJSON('/contigsets/' + contigset.id, data, self.contigs);
    });

    self.showFilters = ko.observable(false);
    self.toggleFilters = function() { self.showFilters(!self.showFilters()); };

    // Panels
    self.panels = ko.observableArray([new ChordPanel(), //new BinsetPanel("kek"),
        new ContigsPanel()]);
    self.getPanelTemplate = function(panel) {
        return panel.template;
    };
    self.removePanel = function(panel) {
        self.panels.remove(panel);
    };
    self.newChordPanel = function() {
        self.panels.unshift(new ChordPanel());
    };

    self.removeBinset = function(binset) {
        self.binsets.remove(binset);
    };

    // Data
    $.getJSON('/binsets/', function(data) {
        var binsets = $.map(data, function(bs) { return new Binset(bs); });
        self.binsets(binsets);
        console.log('viewmodel: got binsets');
    });

    $.getJSON('/contigsets/', function(data) {
        var contigsets = $.map(data, function(cs) { return new Contigset(cs); });
        self.contigsets(contigsets);
        self.selectedContigset(self.contigsets()[0]);
        console.log('viewmodel: got contigsets');
    });
}

$(function() {
    ko.applyBindings(new ViewModel());
});
