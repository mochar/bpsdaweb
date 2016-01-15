ko.bindingHandlers.slideVisible = {
    init: function(element, valueAccessor) {
        var visible = ko.unwrap(valueAccessor());
        $(element).toggle(visible);
    },
    update: function(element, valueAccessor) {
        var visible = ko.unwrap(valueAccessor());
        if (visible) {
            $(element).hide().slideDown();
        } else {
            $(element).slideUp();
        }
    }
};

ko.bindingHandlers.tooltip = {
    init: function(element, valueAccessor) {
        var local = ko.utils.unwrapObservable(valueAccessor());
        var options = {placement: 'right'};
        ko.utils.extend(options, local);
        $(element).tooltip(options);
    }
};

ko.bindingHandlers.colorpicker = {
    init: function(element, valueAccessor) {
        var color = valueAccessor();
        $(element).colpick({
            onChange: function(hsb, hex) {
                color('#' + hex);
            }
        });
    }
};

function ContigsPanel() {
    var self = this;
    self.template = "contigsPanel";
    self.isDirty = ko.observable(true);
    self.showSettings = ko.observable(false);
    self.plotData = ko.observable('seqcomp'); // seqcomp || coverage

    self.xData = ko.observable('gc');
    self.xLogarithmic = ko.observable(false);

    self.yData = ko.observable('length');
    self.yLogarithmic = ko.observable(false);

    self.selectedContigset = ko.observable();
    self.selectedContigs = ko.observableArray([]);
    self.contigs = ko.observableArray([]);
    self.covNames = [];

    self.plotOptions = ko.pureComputed(function() {
        var plotData = self.plotData();
        return plotData === 'seqcomp' ? ['gc', 'length'] : self.covNames;
    });

    self.color = ko.observable('#58ACFA');
    self.colorMethod = ko.observable('uniform'); // uniform || binset
    self.colorBinset = ko.observable();
    self.colors = ko.observable({});
    ko.computed(function() {
        var colorMethod = self.colorMethod();
        if (colorMethod === 'uniform') return [];
        var binset = self.colorBinset();
        $.getJSON('/contigsets/' + binset.contigset + '/binsets/' + binset.id + '/bins', function(data) {
            var contigColors = {};
            data.bins.forEach(function(bin) {
                bin.contigs.forEach(function(contig) {
                    contigColors[contig] = bin.color;
                });
            });
            self.colors(contigColors);
        });
    });

    self.updatePlot = function() {
        self.isDirty(false);
        var contigset = self.selectedContigset();
        if (!contigset) return;
        var data = {items: 1000, length: '5000+'};
        var url = '/contigsets/' + contigset.id + '/contigs';
        $.getJSON(url, data, function(data) {
            self.covNames = Object.keys(data.contigs[0].coverages);
            self.contigs(data.contigs.map(function(contig) {
                $.extend(contig, contig.coverages);
                delete contig.coverages;
                return contig;
            }));
        });
    };

    ko.computed(function() {
        var contigset = self.selectedContigset();
        self.isDirty(true);
    });
}

function ChordPanel() {
    var self = this;
    self.template = "chordPanel";
    self.selectedBinset1 = ko.observable(null);
    self.selectedBinset2 = ko.observable(null);
    self.selectedBin = ko.observable();
    self.selectedBins = ko.observableArray([]);
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
        var binsets = [self.selectedBinset1(), self.selectedBinset2()];
        var binIds = binsets[0].bins().concat(binsets[1].bins());
        var data = {bins: binIds.join(',')};
        var url = '/contigsets/' + binsets[0].contigset + '/binsets/';
        $.when(
            $.getJSON('/to_matrix', data),
            $.getJSON(url + binsets[0].id + '/bins'),
            $.getJSON(url + binsets[1].id + '/bins')
        ).done(function(matrix, bins1, bins2) {
            bins1[0].bins.forEach(function(b) {
                $.extend(b, {binsetColor: binsets[0].color()});
            });
            bins2[0].bins.forEach(function(b) {
                $.extend(b, {binsetColor: binsets[1].color()});
            });
            self.bins = bins1[0].bins.concat(bins2[0].bins);
            self.matrix(matrix[0]);
        });
    };
}

function ContigSection() {
    var self = this;
    self.contigs = ko.observableArray([]);
    self.contigsetId = ko.observable();
    self.showFilters = ko.observable(false);
    self.toggleFilters = function() { self.showFilters(!self.showFilters()); };

    // contig selection
    self.allContigsSelected = ko.observable(false);
    self.selectedContigIds = ko.observableArray([]);
    self.selectedAmount = ko.pureComputed(function() {
        if (self.allContigsSelected()) return self.count();
        return self.selectedContigIds().length;
    });
    ko.computed(function() {
        var contigsetId = self.contigsetId();

        // Unselect all contigs
        self.selectedContigIds([]);
        self.allContigsSelected(false);
    });

    // table
    self.view = ko.observable('table'); // Either table or plot
    self.sortBy = ko.observable('name');
    self.sort = function(field) {
        var sortBy = self.sortBy();
        field === sortBy ? self.sortBy('-' + field) : self.sortBy(field);
    };

    // pagination
    self.index = ko.observable(1);
    self.count = ko.observable();
    self.indices = ko.observable();

    // plot
    self.plotData = ko.observable('length'); // Either gc or length
    self.plotContigs = ko.observable([]);
    ko.computed(function() {
        var contigsetId = self.contigsetId();
        if (!contigsetId) return;
        var view = self.view();
        if (view === 'table') {
            self.plotContigs([]);
            return;
        }
        var plotData = self.plotData();
        var queryOptions = {items: 65000, fields: plotData};
        $.getJSON('/contigsets/' + contigsetId + '/contigs', queryOptions, function(data) {
            self.plotContigs(data.contigs.map(function(contig) {
                return contig[plotData];
            }));
        });
    });

    // New contigset selected
    ko.computed(function() {
        var contigsetId = self.contigsetId();
        if (!contigsetId) return;

        // Get new contig data
        var index = self.index(),
            sort = self.sortBy(),
            queryOptions = {index: index, sort: sort, items: 7,
                fields: 'id,name,gc,length'};
        $.getJSON('/contigsets/' + contigsetId + '/contigs', queryOptions, function(data) {
            self.contigs(data.contigs);
            self.indices(data.indices);
            self.count(data.count);
        });
    });
}

function Binset(data) {
    var self = this;
    self.id = data.id;
    self.contigset = data.contigset;
    self.name = ko.observable(data.name);
    self.color = ko.observable(data.color);
    self.bins = ko.observableArray(data.bins);

    self.showDelete = ko.observable(false);
    self.toggleDelete = function() { self.showDelete(!self.showDelete()); };

    // Renaming
    self.renaming = ko.observable(false);
    self.rename = function() { self.renaming(true); };
    ko.computed(function() {
        var name = self.name();
        $.ajax({
            url: '/contigsets/' + self.contigset + '/binsets/' + self.id,
            type: 'PUT',
            data: {'name': name}
        });
    });
}

function Contigset(data) {
    var self = this;
    self.id = data.id;
    self.name = ko.observable(data.name);
    self.size = ko.observable(data.size); // amount of contigs
    self.binsets = ko.observableArray([]);

    $.getJSON('/contigsets/' + self.id + '/binsets', function(data) {
        self.binsets(data.binsets.map(function(bs) { return new Binset(bs); }));
    });

    self.showDelete = ko.observable(false);
    self.toggleDelete = function() { self.showDelete(!self.showDelete()); };

    // Renaming
    self.renaming = ko.observable(false);
    self.rename = function() { self.renaming(true); };
    ko.computed(function() {
        var name = self.name();
        $.ajax({
            url: '/contigsets/' + self.id,
            type: 'PUT',
            data: {'name': name}
        });
    });
}

function ViewModel() {
    var self = this;
    self.contigsets = ko.observableArray([]);
    self.selectedContigset = ko.observable(null);
    self.selectedBinset = ko.observable(null);
    self.contigSection = new ContigSection();

    self.binsets = ko.pureComputed(function() {
        var contigsets = self.contigsets();
        var binsets = [];
        ko.utils.arrayForEach(contigsets, function(contigset) {
            binsets = binsets.concat(contigset.binsets());
        });
        return binsets;
    });

    self.contigsetsToShow = ko.pureComputed(function() {
        var contigset = self.selectedContigset();
        return contigset ? [contigset] : self.contigsets();
    });

    self.binsetsToShow = ko.pureComputed(function() {
        var contigset = self.selectedContigset();
        var binset = self.selectedBinset();
        if (binset) return binset;
        return contigset ? contigset.binsets() : self.binsets();
    });

    ko.computed(function() {
        var contigset = self.selectedContigset();
        if (!contigset) return;
        self.contigSection.contigsetId(contigset.id);
    });

    self.showElement = function(elem) { if (elem.nodeType === 1) $(elem).hide().slideDown() };
    self.hideElement = function(elem) { if (elem.nodeType === 1) $(elem).slideUp(function() { $(elem).remove(); }) };

    // Panels
    self.panels = ko.observableArray([new ContigsPanel(), new ChordPanel()]);
    self.getPanelTemplate = function(panel) {
        return panel.template;
    };
    self.removePanel = function(panel) {
        self.panels.remove(panel);
    };
    self.newChordPanel = function() {
        self.panels.unshift(new ChordPanel());
    };


    self.deleteBinset = function(binset) {
        $.ajax({
            url: '/contigsets/' + binset.contigset + '/binsets/' + binset.id,
            type: 'DELETE',
            success: function(response) {
            }
        });
        var contigset = self.contigsets().filter(function(cs) {
            return cs.id === binset.contigset;
        })[0];
        contigset.binsets.remove(binset);
    };

    self.deleteContigset = function(contigset) {
        $.ajax({
            url: '/contigsets/' + contigset.id,
            type: 'DELETE',
            success: function(response) {
            }
        });
        self.contigsets.remove(contigset);
    };

    // Data upload
    self.uploadContigset = function(formElement) {
        var formData = new FormData(formElement);
        formElement.reset();
        $.ajax({
            url: '/contigsets',
            type: 'POST',
            data: formData,
            async: false,
            success: function (data) {
                self.contigsets.push(new Contigset(data));
            },
            cache: false,
            contentType: false,
            processData: false
        });
    };

    self.uploadBinset = function(formElement) {
        var formData = new FormData(formElement);
        var contigsetId = $('#binsetContigset').val();
        $('#binTable > tbody > tr').remove();
        formElement.reset();

        $.ajax({
            url: '/contigsets/' + contigsetId + '/binsets',
            type: 'POST',
            data: formData,
            async: false,
            success: function (data) {
                var contigsets = self.contigsets();
                for(var i = 0; i < contigsets.length; i++) {
                    if (contigsets[i].id == contigsetId) {
                        contigsets[i].binsets.push(new Binset(data));
                        break;
                    }
                }
            },
            cache: false,
            contentType: false,
            processData: false
        });
    };

    // Data
    $.getJSON('/contigsets', function(data) {
        self.contigsets($.map(data.contigsets, function(cs) { return new Contigset(cs); }));
        console.log('viewmodel: got contigsets');
    });
}

$(function() {
    ko.applyBindings(new ViewModel());
});
