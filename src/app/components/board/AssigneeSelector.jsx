const React = require('react');
const Dropdown = require('./Dropdown');
const Utils = require('../../utils');

var AssigneeSelector = React.createClass({

    render : function(){

        var assignTo = function(collaborator,event){
            event.preventDefault();
            this.props.issueManager.assignTo(this.props.issue,collaborator);
        }.bind(this);

        var userHtml = function(user){
            return <span><img width="16" height="16" src={user.avatar_url+'&s=16'} /> {user.login}</span>
        }.bind(this);

        var dropdownContent;
        if (this.props.collaborators){
            var collaboratorLinks = this.props.collaborators.map(function(collaborator){
                return <A key={collaborator.id} href="#" onClick={assignTo.bind(this,collaborator)}>{userHtml(collaborator)}</A>
            }.bind(this));
            collaboratorLinks.push(undefined);
            collaboratorLinks.push(<A key={0} href="#" onClick={assignTo.bind(this,null)}> <i className="fa fa-trash" />&nbsp;&nbsp;remove assignee</A>);
            dropdownContent = collaboratorLinks;
        }
        return <Dropdown disabled={!Utils.isLoggedIn()} onClick={this.props.onClick} title={(this.props.issue.assignee ? userHtml(this.props.issue.assignee) : ' no one assigned')}>
            {dropdownContent}
        </Dropdown>;
    }
});

module.exports = AssigneeSelector;