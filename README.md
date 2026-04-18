# osolot: Open Source Organic Libraries of Things

osolot helps people pool their resources.

You can use my printer, and maybe I can borrow your wheelbarrow.
People already do this, but now we can insert technology in the mix. That will surely make things better.

Coordinating that across lots of people is hard, and this aims to make that easier.

Features

* Personal profile and inventory of your stuff
* Start or join multiple groups ("collectives")
* Collective admins & moderators
* Individual collective settings (public/private, anyone can join / require approval)
* Precise sharing controls for each collective
* View/request stuff shared with you across all collectives
* Friends

## Why?

I think this addresses a gap in the market. There are some apps that can be used for similar things, but they fall short in various ways.

Craigslist

* Public postings only
* Transactions, not borrowing
* Postings expire

Facebook groups (e.g. buy nothing) or group chats

* No clear 'inventory', especially for older posts
* Often giving things away, not lending them

Nextdoor

* Same problems: transactions, feeds, no inventory besides what is recently offered

Similar projects, that are just a bit off from what I'm imagining. They may work better for your use case:

* [Peerby](https://www.peerby.com/en-us)
* [Neigborgoods](http://neighborgoods.com)
* [Bonfire](http://bonfirenetworks.org)
* [Inventaire](https://inventaire.io/)
* [Borrowme](https://borrowme.co/)

## On trust

This is not expected to be a 'lend to random strangers' app.

Trust should be established off the app.\
Accountability should be handled off the app.

It's on you to decide whether you trust someone enough to share with them.

But also, just be nice.

## "Organic"?

Partly, it makes the acronym work, but it's also part of the goal.

Collectives can start with just a few people, and grow organically from there.

In theory, the larger a collective, the better it is for each person in it.

## Roadmap

### Milestone 1 (MVP): share/request stuff with groups

Current status: Implementing server, vibe-coded client

* ~~Account management~~
  * ~~Create account~~
  * ~~Forgot password~~
  * ~~Verify email~~
* Profile management
  * ~~Username~~
  * ~~First & last name~~
  * Public bio
  * Location (+ fuzzing)
* Collective management
  * Create/edit collective
    * Require verified email
  * Collective location + area
  * Collective visibility management
    * ~~Public~~
    * Unlisted (only visible with link)
      * Obfuscate collective links (don't use auto-incrementing id)
  * Collective content visiblity
    * Only members see members
    * Only members see shared items
  * ~~Admission type management~~
    * ~~Open~~
    * ~~Request/approve~~
  * ~~Roles in collectives~~
    * ~~Only admins can edit collective & change roles~~
    * ~~Admins and moderators can manage members~~
* Offer/request management
  * Create/edit offer/request
    * Require verified email
  * Sharing configuration
    * Public
    * (Specific) collectives
    * Hidden
* View offers/requests
  * List view
  * Map view
  * Search / filter by
    * Location (default)
    * Collective
    * User
    * Title
* Contact owners
  * Require verified email
  * Send email w/ replyto
* Feedback / report a problem
  * Configurable server admin email
  * Send email to server admin, including diagnostic information
    * User info
    * Page the user is on
    * Server timestamp (don't rely on the email's timestamp)
* Productionization
  * Quota / rate limits
  * Whatever WSGI or ASGI is
  * Hosting, etc
  * Rewrite client

### Future (in rough order)

This includes a lot of stuff that probably won't be implemented for like a year+, if ever.

* Photos
  * User profile photos
  * Collective photos
  * Offer photos
  * Depending on cost, add a donation page
* Friends
  * Request/confirm friend
  * Sharing with friends
  * Friend circles / sharing presets
* Android/iOS app
  * Webview
* Notifications
  * User responded to your post
  * User requests to join your collective
  * Friend requests
* More options
  * Collectives
    * Visiblity
      * Private: members-only
      * Local: based on collective + user location
    * Invite-only admission
    * Content visiblity
  * Users
    * Profile visiblity settings
      * Visiblity
        * Logged-in users only
        * Group members or friends-only
        * Friends of friends
      * "How others see you" controls
        * Name
        * Location
        * Bio
  * Offers/requests
    * Categories
    * Sharing controls: (specific) friends, mutuals(?)
    * Anonymous offers/requests
* Bad actors
  * Report users or posts
  * Block users
  * (Admin) ban users
* Events
  * Create/edit event
  * Add needed items to an event (e.g. potluck)
  * Respond to event requests
  * Add additional "I'm bringing x"
* Show entity relationship to viewer
  * Collective
    * Role
    * Friends in collective
  * User
    * Mutuals
    * Collectives in common
* Inventory management
  * Personal inventory tracking
  * Transfer items to other users
* Collective federation
  * Collective federation settings
    * Allow requests from anyone (w/o showing who's offering)
    * Allow requests from certain other collectives
    * Show offers to other collectives
  * View offers from other collectives in the area
* Server admin enhancements
  * Surface consistency problems, e.g. collective w/o admin
  * Alternative contact methods
  * Integrate with monitoring platform
* Maybe: Social media feed stuff
  * Share how you used a thing ("check out these cupcakes I made!")
  * Comments, likes
  * I don't really like the idea of "reviews" though, tbd on whether it'd get nasty.
