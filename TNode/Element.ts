class TNode_Element extends TNode {

	public childNodes                : TNode[]        = [];
	public style                     : TStyle;
	public nodeType                  : TNode_Type     = TNode_Type.ELEMENT;
	public nodeName                  : string         = '';
	public id                        : string         = '';
	public className                 : string         = '';

	public isSelectable              : boolean        = false; // weather the element is rendered as selected when the user clicks on it
	public isResizable               : boolean        = false; // weather the element is rendered with resize handles when it's focused
	public isPaintedSelected         : boolean        = false; // weather during the last paint, the element was painted as outer selected.

	public isBlockTextNode           : boolean        = false; // on elements in which user can write, this property must be set to true.
	
	// what happens when a user press enter, the element is "cutted", or a <br /> tag is inserted at cursor position
	public insertLinePolicy          : TNewLinePolicy = TNewLinePolicy.SURGERY;
	public alternateInsertLinePolicy : TNewLinePolicy = TNewLinePolicy.BR;

	public isMergeable               : boolean        = true; // weather the "mergeWith" method works with this or with another element.

	constructor( postStyleInit: boolean = false ) {
		super();

		if ( !postStyleInit )
			this.style = new TStyle( this );
	}

	public appendChild( node: TNode, index: number = null ): TNode {
		if ( index === null ) {
			node.remove();
			index = this.childNodes.length;
			this.childNodes.push( node.remove() );
		} else {
			if ( index < 0 ) {
				index = 0;
			} else if ( index > this.childNodes.length ) {
				index = this.childNodes.length;
			}
			node.remove();
			this.childNodes.splice( index, 0, node );
		}
		node.parentNode = this;

		for ( var i=index, len = this.childNodes.length; i<len; i++ ) {
			this.childNodes[i].siblingIndex = i;
		}

		this.requestRelayout();
		
		return node;
	}

	public appendCollection( collection: TNode_Collection, siblingIndex: number = null ) {
		
		siblingIndex = siblingIndex === null
			? this.childNodes.length
			: siblingIndex;

		var args: any[] = [ siblingIndex, 0 ],
		    i: number = 0,
		    len: number = collection.nodes.length;

		for ( i=0; i<len; i++ ) {
			args.push( collection.nodes[i] );
			collection.nodes[i].remove();
		}

		this.childNodes.splice.apply( this.childNodes, args );

		for ( i=0, len = this.childNodes.length; i<len; i++ ) {
			this.childNodes[i].parentNode = this;
			this.childNodes[i].siblingIndex = i;
		}

		this.requestRelayout();

	}

	public removeChild( node: TNode ): TNode {
		for ( var i=0, len = this.childNodes.length; i<len; i++ ) {
			if ( this.childNodes[i] == node ) {
				
				this.childNodes.splice( i, 1 );
				
				for ( var j=i, len = this.childNodes.length; j<len; j++ ) {
					this.childNodes[j].siblingIndex = j;
				}
				
				this.requestRelayout();
				
				return node;
			}
		}
		throw "ERR_NODE_NOT_FOUND";
	}

	/* Weather painting this element is inside of a box, or this element
	   is painted as a text line */

	public hasLayout(): boolean {
		return this.style.display() == 'block' ||
			   this.style.float() != '';
	}

	public createLayout( useParentLayout: Layout = null ): Layout {

		if ( this.documentElement ) {

			var left: Layout_Block[] = [],
			    center: Layout_Block[] = [],
			    right: Layout_Block[] = [],
			    argIndex: number = 0,
			    i: number,
			    len: number,
			    returnValue: Layout;

			this.evaluateLayout( left, center, right, argIndex );

			switch ( true ) {

				case center.length == 0 && left.length == 0 && right.length == 0:
					/* The node is empty */
					if ( this.hasLayout() ) {
						returnValue = new Layout_Block( this );
					} else {
						returnValue = new Layout_BlockChar();
					}
					break;

				case center.length > 0 && left.length == 0 && right.length == 0:

					/* Return a Layout_Vertical if center.length > 1 or center[0] if center.length == 1; */
					returnValue = new Layout_Vertical( this, center );

					break;

				case ( left.length > 0 || right.length > 0 ) && center.length == 0:

					/* Return a Layout_Horizontal, containing the left cells combined with the right cells */

					for ( i=0, len = right.length; i<len; i++ ) {
						left.push( right[i] );
					}

					returnValue = new Layout_Horizontal( this, left );

					break;

				case ( left.length > 0 || right.length > 0 ) && center.length > 0:

					var cells: Layout[] = [];

					if ( left.length ) {
						cells.push( left.length == 1 ? left[0] : new Layout_Horizontal( null, left ) );
					}

					if ( center.length ) {
						cells.push( new Layout_Vertical( null, center ) );
					}

					if ( right.length ) {
						cells.push( right.length == 1 ? right[0] : new Layout_Horizontal( null, right ) );
					}

					returnValue = new Layout_Horizontal( this, cells );

					break;

				default:
					throw "Unhandled layout variant!";
					break;

			}

			if ( useParentLayout ) {
				returnValue.parent = useParentLayout;
			}

			returnValue.buildAhead( useParentLayout );

			return returnValue;

		} else {

			return null;

		}

	}

	private childNodesSortedByFloatValues(): TNode[] {

		var out1: TNode[] = [],
		    out2: TNode[] = [],
		    i: number = 0,
		    len: number = 0;

		for ( i=0, len=this.childNodes.length; i<len; i++ ) {
			
			if ( this.childNodes[i].nodeType == TNode_Type.TEXT ) {
			
				out2.push( this.childNodes[i] );
			
			} else {
				if ( ['left', 'right' ].indexOf( (<TNode_Element>this.childNodes[i]).style.float() ) > -1 ) {
					out1.push( this.childNodes[i] );
				} else {
					out2.push( this.childNodes[i] );
				}
			}
			
		}

		for ( i=0, len = out2.length; i<len; i++ ) {
			out1.push( out2[i] );
		}

		return out1;

	}

	public evaluateLayout( left: Layout_Block[], center: Layout_Block[], right: Layout_Block[], argIndex: number = 0 ): number {
		var i: number = 0,
		    len: number = this.childNodes.length,
		    oldArgIndex: number = argIndex,
		    currentArgIndex: number = argIndex,
		    j: number = 0,
		    n: number = 0,
		    layoutType: string = '',
		    lblock: Layout_Block,
		    lchar: Layout_BlockChar,
		    children: TNode[];

		for ( i=0, children = this.childNodesSortedByFloatValues(), len = children.length; i<len; i++ ) {
			
			if ( children[i].nodeType == TNode_Type.TEXT ) {
				currentArgIndex = 1;
				layoutType = 'Layout_BlockChar';
			
			} else {
				
				switch ( true ) {
					case (<TNode_Element>children[i]).style.display() == 'block' && ['left', 'right'].indexOf( (<TNode_Element>children[i]).style.float() ) == -1:
						layoutType = 'Layout_Block';
						currentArgIndex = 1;
						break;
					case (<TNode_Element>children[i]).style.float() == 'left':
						layoutType = 'Layout_Block';
						currentArgIndex = 0;
						break;
					case (<TNode_Element>children[i]).style.float() == 'right':
						layoutType = 'Layout_Block';
						currentArgIndex = 2;
						break;
					default:
						layoutType = 'Layout_BlockChar';
						currentArgIndex = 1;
						break;
				}

			}

			switch ( layoutType ) {

				case 'Layout_BlockChar':
					
					if ( currentArgIndex != oldArgIndex ) {
					
						lchar = new Layout_BlockChar();
						center.push( lchar );
					
					} else {
					
						lchar = <Layout_BlockChar>( ( function() {
								if ( center[ center.length - 1 ] && center[ center.length - 1 ].hasChars ) {
									return center[ center.length - 1 ];
								} else {
									return null;
								}

							} )() || ( function() {
								lchar = new Layout_BlockChar();
								center.push( lchar );
								return lchar;
						} )() );
					
					}
					
					if ( children[i].nodeType == TNode_Type.TEXT ) {
						lchar.addTextNode( <TNode_Text>children[i] );
					} else {
						currentArgIndex = (<TNode_Element>children[i]).evaluateLayout( left, center, right, currentArgIndex );
					}

					break;

				case 'Layout_Block':
					lblock = new Layout_Block( <TNode_Element>children[i] );
					switch ( currentArgIndex ) {
						case 0:
							left.push( lblock );
							break;
						case 1:
							center.push( lblock );
							break;
						case 2:
							right.push( lblock );
							break;
					}
					break;
			}

			oldArgIndex = currentArgIndex;
		}

		return currentArgIndex;
	}

	public innerHTML( setter: string = null ): string {
		if ( setter === null ) {
			// getter
			if ( !this.childNodes.length ) {
				return '';
			} else {
				var out: string[] = [];
				for ( var i=0, len = this.childNodes.length; i<len; i++ ) {
					if ( this.childNodes[i].nodeType == TNode_Type.TEXT ) {
						out.push( ( <TNode_Text>this.childNodes[i] ).escape() );
					} else {
						out.push( ( <TNode_Element>this.childNodes[i] ).outerHTML() );
					}
				}
				return out.join( '' );
			}
		} else {

			var nodes = ( new HTMLParser( this.documentElement, setter ) ).NODES;
			this.setInnerNodes( nodes );
		}
	}

	public xmlBeginning(): string {
		return '<' + this.nodeName + ( this.childNodes.length ? '' : '/' ) + '>';
	}

	public xmlEnding(): string {
		if ( !this.childNodes.length ) {
			return '';
		} else {
			return '</' + this.nodeName + '>';
		}
	}

	public outerHTML( setter: string = null ) {
		if ( setter === null ) {
			// getter
			return this.xmlBeginning() + this.innerHTML() + this.xmlEnding();
		} else {
			throw "node.outerHTML: Setter not implemented yet!";
		}
	}


	public requestRelayout() {
		if ( this.documentElement ) {
			this.documentElement.needRelayout = true;
		}
	}

	public requestRepaint( originatingElement: TNode_Element = null ) {
		if ( this.documentElement ) {
			this.documentElement.requestRepaint();
		}
	}

	/* Paints the node according to layout configuration */
	public paint( ctx: any, layout: Layout, scrollLeft: number, scrollTop: number ) {

		// paint border

		var borderColor: string,
		    borderWidth: number,
		    backgroundColor: string,
		    range = this.documentElement.viewport.selection.getRange(),
		    isSelected: boolean = false;

		if ( ( range.equalsNode( this ) && this.isSelectable ) || ( range.contains( this.FRAGMENT_START + 1 ) && range.contains( this.FRAGMENT_END - 1 ) ) ) {
			isSelected = true;
			ctx.fillStyle = 'blue';
			ctx.fillRect( ~~( layout.innerLeft - scrollLeft) , ~~( layout.innerTop - scrollTop ), ~~layout.innerWidth, ~~layout.innerHeight );
		}

		this.isPaintedSelected = isSelected;

		if ( ( borderWidth = this.style.borderWidth() ) ) {
			
			borderColor = this.style.borderColor();
			
			if ( borderColor ) {
				
				ctx.strokeStyle = borderColor;
				ctx.lineWidth   = borderWidth;

				ctx.beginPath();
				ctx.strokeRect( layout.offsetLeft + ( borderWidth / 2) - scrollLeft, layout.offsetTop + ( borderWidth / 2 ) - scrollTop, layout.offsetWidth - borderWidth, layout.offsetHeight - borderWidth );
				ctx.closePath();
			}
		}

		if ( ( backgroundColor = this.style.backgroundColor() ) && !isSelected ) {
			ctx.fillStyle = backgroundColor;
			ctx.fillRect( layout.offsetLeft + borderWidth - scrollLeft, layout.offsetTop + borderWidth - scrollTop, layout.offsetWidth - 2 * borderWidth, layout.offsetHeight - 2 * borderWidth );
		}

	}

	// makes the array of nodes @nodesList childNodes of this element.
	// if @scope is null, the contents of this element will be erased before.
	// if @scope is NOT null, the setInnerNodes method will be executed on
	//    @scope instead of this element.
	public setInnerNodes( nodesList: any[], scope: TNode_Element = null ) {

		var len: number = this.childNodes.length,
		    i: number = 0,
		    j: number = 0,
		    n: number = 0,
		    clearNodes: boolean = scope === null,
		    node: TNode_Element = null,
		    nodeName: string = '';

		scope = scope || this;

		if ( clearNodes )
			scope.childNodes.splice( 0, len ); // clear the child nodes of this element

		for ( i=0, len = nodesList.length; i<len; i++ ) {

			switch ( nodesList[i].type ) {
				case 'node':

					nodeName = nodesList[i].nodeName;

					if ( HTML_Body.IGNORE_ELEMENTS.indexOf( nodeName ) == -1 ) {

						if ( HTML_Body.TRAVERSE_ELEMENTS.indexOf( nodeName ) == -1 ) {

							node = scope.documentElement.createElement( nodeName );

							scope.appendChild( node );

							if ( nodesList[i].attributes && ( n = nodesList[i].attributes.length ) ) {
								
								for ( j=0; j<n; j++ ) {

									node.setAttribute( nodesList[i].attributes[j].name, nodesList[i].attributes[j].value );
								
								}
							
							}

						} else {

							node = scope;

						}

						if ( nodesList[i].children && nodesList[i].children.length ) {
							node.setInnerNodes( nodesList[i].children, node );
						}

					}


					break;

				case '#text':

					if ( nodesList[i].value )
						scope.appendChild( scope.documentElement.createTextNode( nodesList[i].value ) );

					break;

				default:
					// comments and cdata are not supported
					break;
			}

		}

	}

	public setAttribute( attributeName: string = '', attributeValue: string = null ) {
		switch ( attributeName ) {
			case 'id':
				this.id = String( attributeValue || '' );
				break;
			case 'class':
				this.className = String( attributeValue || '' );
				break;
			case 'align':
				this.style.textAlign( String( attributeValue || '' ) );
				break;
			case 'color':
				this.style.color( String( attributeValue || '' ) );
				break;
			case 'width':
				this.style.width( String( attributeValue || '' ) );
				break;
			case 'height':
				this.style.height( String( attributeValue || '' ) );
				break;
			case 'bgcolor':
				this.style.backgroundColor( String( attributeValue || '' ) );
				break;
		}
	}

	protected satisfiesQuery( query: any ) {
		var cond: boolean,
		    cursor: TNode_Element;
		
		for ( var k in query ) {

			if ( query[k] === true ) {

				cond = !!query[k] == this[k];

			} else {
				
				switch ( true ) {
					case k == 'parentNode':
						cond = !!this.parentNode && this.parentNode.satisfiesQuery( query.parentNode )
							? true
							: false;
						break;
					case k == 'anyParentNode':
						cond = false;
						cursor = this.parentNode;
						while ( cursor ) {
							if ( cursor.satisfiesQuery( query.anyParentNode ) ) {
								cond = true;
								break;
							}
							cursor = cursor.parentNode;
						}
						break;
					default:
						cond = query[k] == this[k];
						break;
				}
			}

			if ( cond == false )
				return false;
		}
		return true;
	}

	/* queryElements( {
			"nodeName": "p",
			"childNodes": true
	   } ) 
	*/

	public queryAll( query: any, pushIn: TNode_Collection = null ): TNode_Collection {

		pushIn = pushIn || new TNode_Collection();
		query = query || {};

		for ( var i=0, len = this.childNodes.length; i<len; i++ ) {
			if ( this.childNodes[i].nodeType == TNode_Type.ELEMENT ) {
				if ( (<TNode_Element>this.childNodes[i]).satisfiesQuery( query ) ) {
					pushIn.add( <TNode_Element>this.childNodes[i] );
				}
				(<TNode_Element>this.childNodes[i]).queryAll( query, pushIn );
			}
		}

		return pushIn;

	}

	public query( query: any ): TNode_Element {

		var sub: TNode_Element;
		query = query || {};
		if ( this.satisfiesQuery( query ) ) {
			return this;
		} else {
			for ( var i=0, len = this.childNodes.length; i<len; i++ ) {
				if ( this.childNodes[i].nodeType == TNode_Type.ELEMENT ) {
					if ( sub = ( <TNode_Element>this.childNodes[i] ).query( query ) ) {
						return sub;
					}
				}
			}
		}

		return null;

	}

	public bakeIntoFragment() {
		if ( this.documentElement ) {
			
			this.FRAGMENT_START = this.documentElement.fragment.length();
			this.documentElement.fragment.add( FragmentItem.NODE_START );

			var i: number =0,
			    len: number = 0;

			if ( this.childNodes && ( len = this.childNodes.length ) ) {
				for ( i=0; i<len; i++ ) {
					this.childNodes[i].bakeIntoFragment();
				}
			}

			this.FRAGMENT_END = this.documentElement.fragment.length();
			this.documentElement.fragment.add( FragmentItem.NODE_END );
		}
	}

	public containsNode( node: TNode_Element ): boolean {
		if ( node && this.documentElement && node.documentElement && this.documentElement == node.documentElement ) {
			this.documentElement.requestRelayoutNowIfNeeded();
			return node.FRAGMENT_START > this.FRAGMENT_START && node.FRAGMENT_START < this.FRAGMENT_END;
		} else return false;
	}

	/* Compares the document position between 2 nodes in DOM.
	   negative values means the node is Before, positive values means the
	   node is after
	 */
	public compareDocumentPosition( node: TNode_Element ): number {
		if ( node && this.documentElement && node.documentElement && this.documentElement == node.documentElement ) {
			this.documentElement.requestRelayoutNowIfNeeded();
			return this.FRAGMENT_START - node.FRAGMENT_START;
		} else return -1;
	}

	/* Recursively finds a node that is mapped to the document fragment
	   at position @index.
	 */
	public findNodeAtIndex( index: number ): TNode {
		
		var i: number = 0,
		    len: number = 0,
		    match: TNode;

		if ( this.documentElement ) {
			
			this.documentElement.requestRelayoutNowIfNeeded();

			if ( index == this.FRAGMENT_START || index == this.FRAGMENT_END ) {

				return this;

			} else if ( index < this.FRAGMENT_START || index > this.FRAGMENT_END ) {
			
				return null;
			
			} else {

				for ( i=0, len = this.childNodes.length; i<len; i++ ) {

					if ( this.childNodes && ( len = this.childNodes.length ) ) {
						
						if ( this.childNodes[i].nodeType == TNode_Type.TEXT ) {

							if ( index >= this.childNodes[i].FRAGMENT_START && index <= this.childNodes[i].FRAGMENT_END ) {
								return this.childNodes[i];
							}

						} else {

							match = (<TNode_Element>this.childNodes[i]).findNodeAtIndex( index );
							
							if ( match !== null ) {
								return match;
							}
						}
					}

				}

				return this;
			}

		} else return null;

	}

	// removes the empty nodes from the document
	public removeOrphanNodes() {

		if ( this.childNodes ) {

			if ( !this.childNodes.length ) {
			
				this.remove();
			
			} else {
			
				for ( var i=this.childNodes.length - 1; i>=0; i-- ) {
					
					if ( this.childNodes[i].nodeType == TNode_Type.ELEMENT ) {
						(<TNode_Element>this.childNodes[i]).removeOrphanNodes();
					} else {
						if ( (<TNode_Text>this.childNodes[i]).textContents() == '' ) {
							this.childNodes[i].remove();
						}
					}
				}
			
			}

		}

	}

	public ownerBlockElement(): TNode_Element {
		if ( this.isBlockTextNode ) {
			return this;
		} else {
			if ( this.parentNode ) {
				return this.parentNode.ownerBlockElement();
			} else {
				return null;
			}
		}
	}

	/* A very special function.

	   @fragmentIndex: an index somewhere *between* node fragment start and node fragment end.

	   @createNodeAfter: boolean: weather to create a node after this node, or to make the
	                     surgery inside of the node

	   @nodeNameAfter argument is taken in consideration only if 2nd argument is true:
	   		- if nodeNameAfter === null, a node with the same name as this node will be used.
	   		- otherwise, a node with a nodeNameAfter will be appended in this document.

		returns the FRAGMENT_START of the right cutted part.

	*/

	public createSurgery( atFragmentIndex: number, createNodeAfter: boolean = true, nodeNameAfter: string = null ): number {
		
		console.warn( 'create surgery: BEGIN ' + this.nodeName + " " + atFragmentIndex + ", " + this.FRAGMENT_START + "," + this.FRAGMENT_END );

		var splitNode: TNode,
			lParent: TNode_Element,
			rParent: TNode_Element = null,
			t1: string = '',
			t2: string = '',
			leftCol : TNode_Collection,
			rightCol: TNode_Collection,
			rNode: TNode_Text;

		if ( atFragmentIndex <= this.FRAGMENT_START || atFragmentIndex >= this.FRAGMENT_END ) {
			throw "ERR_SURGERY_OUTSIDE_BOUNDS!";
		}

		if ( ( atFragmentIndex == this.FRAGMENT_START + 1 ) && createNodeAfter === false ) {	 
			return atFragmentIndex;
		}

		if ( ( atFragmentIndex == this.FRAGMENT_END - 1 ) ) {
			if ( createNodeAfter === false ) {
				return atFragmentIndex;
			} else {
				rParent = this.documentElement.createElement( nodeNameAfter === null ? this.nodeName : nodeNameAfter );
				this.parentNode.appendChild( rParent, this.siblingIndex + 1 );
				return rParent.FRAGMENT_START;
			}
		}

		// find the exact element which has the atFragmentIndex position

		splitNode = this.findNodeAtIndex( atFragmentIndex );

		// avoid spliting the TNodeText inside br tags. ( split after ).
		if ( splitNode.nodeType == TNode_Type.TEXT && (<TNode_Text>splitNode).isBR ) {
			splitNode = splitNode.parentNode;
			atFragmentIndex = splitNode.FRAGMENT_END;
		}

		if ( splitNode.nodeType == TNode_Type.TEXT && splitNode.FRAGMENT_START != atFragmentIndex && splitNode.FRAGMENT_END + 1 != atFragmentIndex ) {
			// we split at text
			t1 = (<TNode_Text>splitNode).textContentsFragment( splitNode.FRAGMENT_START, atFragmentIndex - 1 );
			
			t2 = (<TNode_Text>splitNode).textContentsFragment( atFragmentIndex, splitNode.FRAGMENT_END );
			
			leftCol = new TNode_Collection( [ splitNode ] );

			rightCol = new TNode_Collection( splitNode.elementsAfterMyself( true ) );

			rightCol.addFirst( this.documentElement.createTextNode( t2 || ' ' ) );

			(<TNode_Text>splitNode).textContents( t1 || ' ' );

			splitNode.parentNode.appendChild( rightCol.at(0), splitNode.siblingIndex + 1 );

			lParent = splitNode.parentNode;
			rParent = this.documentElement.createElement( lParent.nodeName );

			rightCol = rightCol.wrapIn( rParent );
			leftCol  = leftCol.wrapIn( lParent );

		} else {
			// we split before or after an element
			if ( atFragmentIndex == splitNode.FRAGMENT_START ) {
				//before
				
				leftCol = new TNode_Collection( splitNode.elementsBeforeMyself( false ) );
				rightCol= new TNode_Collection( splitNode.elementsAfterMyself( true ) );

			} else {

				leftCol = new TNode_Collection( splitNode.elementsBeforeMyself( true ) );
				rightCol = new TNode_Collection( splitNode.elementsAfterMyself( false ) );

			}

			lParent = splitNode.parentNode;
			rParent = this.documentElement.createElement( lParent.nodeName );

			rightCol.wrapIn( rParent );
		}

		while ( lParent != this ) {

			leftCol = new TNode_Collection( lParent.elementsBeforeMyself( true) );
			rightCol= new TNode_Collection( lParent.elementsAfterMyself( false ) );

			rightCol.addFirst( rParent );

			rParent = this.documentElement.createElement( lParent.parentNode.nodeName );

			rightCol.wrapIn( rParent );

			lParent = lParent.parentNode;
			
		}

		//console.log( rightCol );

		if ( createNodeAfter ) {

			if ( nodeNameAfter === null || nodeNameAfter == this.nodeName ) {
				// nothing, rParent is good.
				//console.log( 'rNOTHING!' + rParent.innerHTML() );
			} else {
				( rightCol = new TNode_Collection( rParent.childNodes ) ).wrapIn( rParent = this.documentElement.createElement( nodeNameAfter ) );
				rightCol.wrapIn( rParent );
				//console.warn( 'rightCol: ' + rightCol.innerHTML() );

			}

			this.parentNode.appendChild( rParent, this.siblingIndex + 1 );

			if ( rParent.innerHTML() == '' ) {
				rParent.appendChild( this.documentElement.createTextNode( ' ' ) );
			}

		} else {

			rightCol = new TNode_Collection( rParent.childNodes );

			//console.log( rightCol.innerHTML() );

			// append all the contents of the rParent to myself
			rightCol.wrapIn( this );

			this.documentElement.relayout(true);

			if ( rightCol.length ) {
				return rightCol.at(0).FRAGMENT_START;
			} else {
				return this.FRAGMENT_END - 1;
			}

		}

		if ( this.innerHTML() == '' ) {

			this.innerHTML('');
			this.appendChild( this.documentElement.createTextNode( ' ' ) );

		}

		// force a document relayout, mandatory!
		this.documentElement.relayout(true);

		return rParent.FRAGMENT_START;
	}

	public mergeWith( element: TNode_Element ) {

		if ( this.isMergeable && element.isMergeable ) {

			if ( element.nodeName != 'br' && element.childNodes && element.childNodes.length ) {
				
				var nodes = Array.prototype.slice.call( element.childNodes, 0 ),
				    i: number = 0,
				    len: number = nodes.length;

				for ( i=0; i<len; i++ ) {
					this.appendChild( nodes[i] );
				}

			}
			
			element.remove();

		} else {
			throw "ERR_CANNOT_MERGE_ELEMENTS";
		}
	}

	public lastChild(): TNode {
		return !this.childNodes ? null : ( this.childNodes[ this.childNodes.length - 1 ] || null );
	}

	public firstChild(): TNode {
		return !this.childNodes ? null : ( this.childNodes[ 0 ] || null );
	}

}