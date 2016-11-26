
/*jshint quotmark:false */
/*jshint white:false */
/*jshint trailing:false */
/*jshint newcap:false */
/*global React, Router*/

/*
Copyright (c) 2015 - Andreas Dewes

This file is part of Gitboard.

Gitboard is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

const React = require('react');
const $ = require('jquery');
const Moment = require('moment');
import { Link } from 'react-router';

const Utils = require('../../utils');
const LoaderMixin = require('../mixins/loader');
const GithubErrorHandlerMixin = require('../mixins/github_error_handler')
const FlashMessagesService = require('../../flash_messages');
const IssueManager = require('../../helpers/issue_manager');

const IssueItem = require('./IssueItem');
const IssueList = require('./IssueList');








var Board = React.createClass({

    displayName: 'SprintBoard',
    mixins : [LoaderMixin,GithubErrorHandlerMixin],

    resources : function(props,state){
        var convertToArray = function(data){
            var arr = [];
            for(var i in data) {
                if(data.hasOwnProperty(i) && !isNaN(+i)) {
                    arr[+i] = data[i];
                }
            }
            return arr;
        }
        const repositoryId = `${props.params.repositoryOwner}/${props.params.repositoryName}`;

        const r = [
            {
                name : 'repository',
                endpoint : this.apis.repository.getDetails,
                params : [repositoryId,{}],
                success : function(data,d){
                    return {repository : data};
                }
            },
            {
                name: 'labels',
                endpoint : this.apis.label.getRepositoryLabels,
                params : [repositoryId,{}],
                success : function(data,d){
                    return {labels : convertToArray(data)};
                }
            },
            {
                name : 'openIssues',
                endpoint : this.apis.issue.getIssues,
                params : [repositoryId,{state: 'open',per_page : 100,milestone : props.params.milestoneId || 'none'}],
                success : function(data,d){
                    return {openIssues : convertToArray(data)}
                },
            },
            {
                name : 'closedIssues',
                endpoint : this.apis.issue.getIssues,
                params : [repositoryId,{state :'closed',per_page : 100,milestone : props.params.milestoneId || 'none'}],
                success : function(data,d){
                    var arr = [];
                    for(var i in data) {
                        if(data.hasOwnProperty(i) && !isNaN(+i)) {
                            arr[+i] = data[i];
                        }
                    }
                    return {closedIssues : arr};
                },
            }
        ];
        if (Utils.isLoggedIn()){
            Array.prototype.push.apply(r,[
            {
                name : 'collaborators',
                endpoint : this.apis.repository.getCollaborators,
                params : [repositoryId,{}],
                success : function(data,d){
                    return {collaborators : convertToArray(data)};
                }
            },
            {
                name : 'milestones',
                endpoint : this.apis.milestone.getMilestones,
                params : [repositoryId,{}],
                success : function(data,d){
                    return {milestones : convertToArray(data)};
                }
            },
            ]);
        }
        if (props.params.milestoneId)
            r.push({
                name : 'milestone',
                endpoint : this.apis.milestone.getDetails,
                params : [repositoryId,props.params.milestoneId,{}],
                success : function(data,d){
                    return {milestone : data}
                }
            });
        return r;
    },

    afterLoadingSuccess : function(data){
        data.allIssues = data.openIssues.slice();
        Array.prototype.push.apply(data.allIssues,data.closedIssues);
        data.labelsByName = {};
        for(var i in data.labels){
            data.labelsByName[data.labels[i].name] = data.labels[i];
        }
        const repositoryId = `${this.props.params.repositoryOwner}/${this.props.params.repositoryName}`;

        this.issueManager = new IssueManager({repositoryId : repositoryId,
                                              labelsByName : data.labelsByName,
                                              onResourceChange : this.reloadResources,
                                              onImmediateChange : this.updateView});
        this.processIssues(data.allIssues);
        this.setState({refreshing : false});
        return data;
    },

    processIssues : function(issues){
        for(var i in issues){
            var issue = issues[i];
            issue.timeSpent = this.issueManager.getMinutes(this.issueManager.getTime(issue,'spent'));
            issue.timeEstimate = this.issueManager.getMinutes(this.issueManager.getTime(issue,'estimate'));
        }
    },

    updateView : function(){
        this.processIssues(this.state.data.allIssues);
        this.forceUpdate();
    },

    getInitialState : function(){
        return {dropZone : undefined};
    },

    dragStart : function(issue){
        issue.dragged = true;
        this.setState({draggedIssue : issue});
    },

    moveTo : function(issue,category){
        if (this.issueManager.issueCategories[category]){
            this.issueManager.moveTo(issue,category,this.reloadResources,this.onIssueError);
        }
    },

    dragEnd : function(issue){
        this.moveTo(issue,this.state.dropZone);
        this.state.draggedIssue.dragged = false;
        this.setState({dropZone : undefined,draggedIssue : undefined});
    },

    dragEnter : function(list){
        this.setState({dropZone : list})
    },

    onIssueError : function(xhr){
        FlashMessagesService.postMessage({
            type : "danger",
            description : "An error occurred when trying to update the issue. Please try again..."
        });
        this.reloadResources();
    },

    categorizeIssues : function(issues,draggedIssue,dropZone){
        var categoryData = this.issueManager.issueCategories;
        var categories = {};
        for(var category in categoryData)
            categories[category] = [];
        for (var i in issues){
            var issue = issues[i];
            var category = 'toDo';//the default category
            for (var cat in categoryData){
                if (this.issueManager.isMemberOf(issue,cat)){
                    category = cat;
                    break;
                }
            }
            categories[category].push(issue);
        }
        if (draggedIssue && dropZone && !this.issueManager.isMemberOf(issue,dropZone)){
            const issueCopy = $.extend(true,{},draggedIssue);
            issueCopy.placeholder = true;
            issueCopy.number = 9999999999;
            categories[dropZone].push(issueCopy);
        }
        return categories;
    },

   renderTimeEstimate: function(className, estimate) {
      if (estimate)
        return (<span className={className}>{this.issueManager.formatMinutes(estimate)}</span>);
      return null;
    },

    render: function () {
        var data = this.state.data;
        var categorizedIssues = this.categorizeIssues(data.allIssues,this.state.draggedIssue,this.state.dropZone);
        var issueItems = {};
        var times = {};


        var totalTimes = {estimate : 0,spent : 0};

        var categoryData = this.issueManager.issueCategories;
        for (var category in categorizedIssues){
            var issues = categorizedIssues[category];
            times[category] = {estimate : 0,spent : 0};
            for(var i in issues){
                var issue = issues[i];
                if (issue.placeholder)
                    continue;
                if (issue.timeEstimate){
                    times[category].estimate+=issue.timeEstimate;
                    totalTimes.estimate+=issue.timeEstimate;
                }
                if (issue.timeSpent){
                    times[category].spent+=issue.timeSpent;
                    totalTimes.spent+=issue.timeSpent;
                }
            }
            issueItems[category] = issues.sort(function(issueA,issueB){return (new Date(issueA.created_at))-(new Date(issueB.created_at));}).map(function(issue){
                return <IssueItem data={this.props.data}
                                  key={issue.number}
                                  issue={issue}
                                  baseUrl={this.props.baseUrl}
                                  params={this.props.params}
                                  showDetails={this.props.params.issueId && this.props.params.issueId == issue.number ? true : false}
                                  collaborators={data.collaborators}
                                  issueManager={this.issueManager}
                                  milestones={data.milestones}
                                  dragStart={this.dragStart}
                                  dragged={issue.id == (this.state.draggedIssue && this.state.draggedIssue.id == issue.id ? true : false)}
                                  dragEnd={this.dragEnd} />;}.bind(this));
            if (!issueItems[category].length)
                issueItems[category] = <div className="panel panel-default">
                    <div className="panel-body">
                        <i>No issues found.</i>
                    </div>
                </div>
        }

        var due;
        var milestoneTitle;
        var milestoneDescription;
        if (data.milestone){
            if (data.milestone.due_on !== null){
                var datestring = Moment(new Date(data.milestone.due_on)).fromNow();
                due = <span className="due"><i className="octicon octicon-clock" /> due {datestring}</span>;
            }

            if (data.milestone.description)
                milestoneDescription = <div className="panel panel-default">
                    <div className="panel-body">
                        <span>{data.milestone.description}</span>
                    </div>
                </div>;

        }


        var addIssue = function(category,event){
            event.preventDefault();
        }.bind(this);

        var issueLists = Object.keys(this.issueManager.issueCategories).map(function(category){
            return <IssueList key={category}
                        addIssue={addIssue.bind(this,category)}
                        dragEnd={this.dragEnd.bind(this,category)}
                        dragEnter={this.dragEnter.bind(this,category)}
                        name={category}
                        active={this.state.dropZone == category ? true : false}>
                    <h4>{this.issueManager.issueCategories[category].title}</h4>
                    <p className="estimates">
                      {this.renderTimeEstimate("time-estimate", times[category].estimate)}
                      {this.renderTimeEstimate("time-spent", times[category].spent)}
                      &nbsp;</p>
                    {issueItems[category]}
                </IssueList>
        }.bind(this))

        var reload = function(e){
            e.preventDefault();
            this.setState({refreshing : true});
            this.reloadResources();
        }.bind(this);

        const repositoryId = `${this.props.params.repositoryOwner}/${this.props.params.repositoryName}`;
        return <div className="container sprintboard">
            <div className="row">
                <div className="col-md-12">
                    <h3><Link to={'/milestones/'+repositoryId}>{data.repository.name}</Link>
                      /
                      <a href={data.milestone.html_url} target="_blank">{data.milestone.title}</a>
                      <a onClick={reload} href="#" className="pull-right refresh-link" title="refresh issues"><i className={"fa fa-refresh"+(this.state.refreshing ? ' fa-spin' : '')} /></a>
                    </h3>
                    <p>
                        {due}
                        &nbsp;
                        {this.renderTimeEstimate("time-estimate", totalTimes.estimate)}
                      {this.renderTimeEstimate("time-spent", totalTimes.spent)}
                    </p>
                    {milestoneDescription}
                </div>
            </div>
            <div className="row">
                {issueLists}
            </div>
        </div>;
    }
});

module.exports = Board;

