(function () {
    'use strict'

    angular.module('shipping', [])

        .factory('shippingService', ["$http", "$q", function ($http, $q) {

            var data,
                promise;

            //set up a promise that will be used to load the data
            function loadData() {

                //if we already have a promise, just return that so it doesn't run twice.
                if (promise) {
                    return promise;
                }

                var deferred = $q.defer();
                promise = deferred.promise;

                if (data) {
                    //if we already have data, return that.
                    deferred.resolve(data);
                } else {
                    $http.get('/api/shipping/locations')
                        .success(function (result) {
                            data = result;

                            deferred.resolve({
                                name: "Earth",
                                children: data
                            });

/*
                            deferred.resolve({
                                    "name": "Africa",
                                    "code": "AFR",
                                    "children": [
                                        {
                                            "name": "Algeria",
                                            "code": "DZ"
                                        },
                                        {
                                            "name": "Angola",
                                            "code": "AO",
                                            "children": [
                                                {
                                                    "name": "Bengo",
                                                    "code": "AO-BGO"
                                                },
                                                {
                                                    "name": "Benguela",
                                                    "code": "AO-BGU"
                                                }
                                            ]
                                        }
                                    ]
                                }
                            );
*/

                        })
                        .error(function () {
                            deferred.reject('Failed to load data');
                        })
                }
                return promise;
            }

            return {
                getData: loadData
            };

        }])

        .directive('locationPicker', ["shippingService", function (shippingService) {

            /**
             * This is the code of a tired soul...
             *
             * I first tried to write it as a recursive pure angular directive without much success,
             * Then I gave birth painfully to this jQuery soup, that does the work awkwardly
             *
             * @param element
             * @param locations
             * @param selected
             * @constructor
             */
            var LocationPicker = function (element, locations, selected) {

                this.selected = selected;

                this.nodeTemplate = " \
                  <li> \
                    <span class='arrow'></span> \
                    <span class='checkbox tristate'></span> \
                    <p class='location' data-code=''><span class='name'></span></p> \
                    <div class='children hidden'><ul></ul></div> \
                  </li> \
                ";

                this.element = $(element).first();

                this.root = $("<ul />");
                this.element.append(this.root);

                this.updateSelection = function () {
                    this.selection = this.root.find(".checkbox.checked ~ p.location").map(function (i, element) {
                        return $(element).data("code");
                    }).get().join(" ; ");

                    this.onChange.call(this, this.selection);
                }

                this.checkParentBefore = function (node) {
                    var isChecked = node.children(".checkbox").first().hasClass("checked"),
                        parent = node.parents(":not(location-picker) li").first();

                    if (parent.length == 1) {

                        var parentIsChecked = parent.find(".checkbox").first().hasClass("checked");

                        if (parentIsChecked) {
                            parent.find(".children > ul > li").addClass("checked");
                            parent.find(".children > ul > li > .checkbox").addClass("checked");
                        }

                        this.checkParentBefore(parent);
                    }
                };

                this.checkParentAfter = function (node) {
                    var isChecked = node.children(".checkbox").first().hasClass("checked"),
                        parent = node.parents(":not(location-picker) li").first();

                    if (parent.length == 1) {
                        var allChildrenChecked = parent.find("> .children > ul > li > .checkbox:not(.checked)").length == 0,
                            atLeastOneChildrenChecked = parent.find("> .children > ul > li .checkbox.checked").length > 0

                        var code = node.find("p.location").data("code");

                        if (!allChildrenChecked) {
                            parent.removeClass("checked");
                            parent.find(".checkbox").first().addClass("indeterminate").removeClass("checked");
                        }
                        else {
                            // All children are checked
                            parent.addClass("checked");
                            parent.find(".children .checkbox, .children li").removeClass("checked").removeClass("indeterminate");
                            parent.find(".checkbox").first().addClass("checked").removeClass("indeterminate");
                        }

                        if (!atLeastOneChildrenChecked) {
                            parent.removeClass("checked");
                            parent.find(".checkbox").first().removeClass("indeterminate").removeClass("checked");
                        }

                        this.checkParentAfter(parent);
                    }
                };

                this.addNode = function (data, parent) {
                    var node = $(this.nodeTemplate).clone(),
                        hasChildren = typeof data.children !== 'undefined' && data.children.length > 0,
                        picker = this;

                    node.find(".name").html(data.name);
                    node.find("p.location").data("code", data.code);

                    node.find(".arrow").click(function (event) {

                        if (hasChildren && node.find(".children ul li").length == 0) {
                            for (var i = 0; i < data.children.length; i++) {
                                picker.addNode(data.children[i], node.find(".children ul").first());
                            }
                        }

                        node.children(".children").toggleClass("hidden");
                    })

                    node.children(".checkbox").click(function (event) {

                        picker.checkParentBefore(node);

                        if (node.children(".checkbox").hasClass("checked")) {

                        }
                        else if (node.children(".checkbox").hasClass("indeterminate")) {
                            node.find(".checkbox").removeClass("indeterminate").removeClass("checked");
                            node.find("li").removeClass("checked");
                        }
                        node.children(".checkbox").toggleClass("checked").removeClass("indeterminate");
                        node.toggleClass("checked");
                        picker.checkParentAfter(node);
                        picker.updateSelection();
                    });

                    parent.append(node);

                    if (hasChildren) {
                        node.find(".arrow").addClass("closed");
                    }

                    if (this.selected.indexOf(data.code) >= 0) {
                        picker.checkParentBefore(node);
                        node.children(".checkbox").toggleClass("checked");
                        node.toggleClass("checked");
                        node.parents(":not(location-picker) li").children(".children").removeClass("hidden");
                    }

                    if (data.code.length === 3  && hasChildren) {
                        // this is a continent but not antartica
                        // pre-load all its countries
                        for (var i = 0; i < data.children.length; i++) {
                            picker.addNode(data.children[i], node.find(".children ul").first());
                        }
                    }

                    for (var i=0; i<this.selected.length; i++) {
                        var code = this.selected[i].substring(0, 2);
                        if (data.code.indexOf(code) == 0 && hasChildren) {
                            for (var i = 0; i < data.children.length; i++) {
                                picker.addNode(data.children[i], node.find(".children ul").first());
                            }

                            node.parents(":not(location-picker) li").children(".children").removeClass("hidden");
                        }
                    }
                }

                for (var i = 0; i < locations.children.length; i++) {
                    this.addNode(locations.children[i], this.root);
                }

                var picker = this;
                this.root.find("li.checked").each(function(i, node){
                    picker.checkParentAfter($(node));
                });

                this.onChange = function () {
                }
            }

            return {
                scope: {
                    location: '=',
                    model: "="
                },
                restrict: 'E',
                template: '<div></div>',

                controller: function ($scope, $element, $attrs) {
                    shippingService.getData().then(function (data) {
                        var picker = new LocationPicker($element.find("div"), data, $scope.model);
                        picker.onChange = function (locations) {
                            $scope.$apply(function ($scope) {
                                $scope.model = locations;
                            })
                        }
                    });
                }
            }

        }])

})();
