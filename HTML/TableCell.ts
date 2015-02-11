class HTML_TableCell extends TNode_Element {
	
	public ownerTable                : HTML_Table      = null;
	
	public tableIndex                : number          = 0; // the index of the cell in it's table
	public rowIndex                  : number          = 0; // the index of the cell in it's row

	protected _colSpan               : number          = 1;
	protected _rowSpan               : number          = 1;

	public edgeLeft                  : HTML_Table_Edge = null;
	public edgeRight                 : HTML_Table_Edge = null;
	public edgeTop                   : HTML_Table_Edge = null;
	public edgeBottom                : HTML_Table_Edge = null;

	public isSelectable              : boolean         = true;
	public isResizable               : boolean         = true;

	public isBlockTextNode           : boolean         = true;

	public insertLinePolicy          : TNewLinePolicy  = TNewLinePolicy.BR;
	public alternateInsertLinePolicy : TNewLinePolicy  = TNewLinePolicy.BR;

	public isMergeable               : boolean = false;

	constructor() {
		super( true );
		this.style = new TStyle_TableCell( this );

		this.nodeName = 'td';
		this.style.display('block');

		TStyle_Browser_Calculator.applyDefaultStyles( this, 'td', [
			'fontSize',
			'fontWeight',
			'paddingTop',
			'paddingBottom',
			'paddingLeft',
			'paddingRight',
			'fontFamily',
			'fontWeight'
		] );


		this.style.padding( '5' );
	}

	public colSpan( value: number = null ): number {
		if ( value === null ) {
		
			return this._colSpan;
		
		} else {
		
			value = ~~value;

			if ( value < 1 ) {
				value = 1;
			}
			
			this._colSpan = value;

			if ( this.ownerTable )
				this.ownerTable.requestCompile();

			return this._colSpan;
		}
	}

	public rowSpan( value: number = null ): number {
		if ( value === null ) {
		
			return this._rowSpan;
		
		} else {
			
			value = ~~value;

			if ( value < 1 ) {
				value = 1;
			}

			this._rowSpan = value;

			if ( this.ownerTable )
				this.ownerTable.requestCompile();

			return this._rowSpan;
		}
	}

	public setAttribute( attributeName: string, attributeValue: string ) {

		switch ( attributeName ) {
			case 'colspan':
				this.colSpan( ~~attributeValue );
				break;
			case 'rowspan':
				this.rowSpan( ~~attributeValue );
				break;
			default:
				super.setAttribute( attributeName, attributeValue );
				break;
		}

	}

	public removeChild( node: TNode ): TNode {
		var returnValue = super.removeChild( node );
		if ( this.childNodes.length == 0 ) {
			
			if ( this.documentElement && this.documentElement._tablesLocked ) {
				// we don't want such behaviour while removeFormatting for example.
			} else {
				this.appendChild( this.documentElement.createTextNode( ' ' ) );
			}
		}
		return returnValue;
	}

	public removeFromDOMAtUserCommand(): boolean {
		this.removeAllChildNodes();
		this.appendChild( this.documentElement.createTextNode( ' ' ) );
		return true;
	}

	// a table cell cannot become other element type.
	public becomeElement( elementName: string ): TNode_Element {
		return this;
	}

	// table cells don't have tabstops
	public tabStop( value: number = null ): number {
		return 0;
	}

	public isTheFirstCell(): boolean {
		if ( this.parentNode ) {
			return !!this.parentNode.previousSibling() == false && !!this.previousSibling() == false;
		} else {
			return false;
		}
	}

	public isTheLastCell(): boolean {
		if ( this.parentNode ) {
			return !!this.parentNode.nextSibling() == false && !!this.nextSibling() == false;
		} else {
			return false;
		}
	}

	public onmousemove( point: TPoint, button: number, driver: Viewport_MouseDriver ): boolean {
		
		if ( button == 0 ) {

			var resizer: TResizer = this.getResizerTypeAtMousePoint( point );

			switch ( resizer ) {

				case TResizer.N:
					if ( this.edgeTop.index == 0 ) {
						driver.viewport.canvas.style.cursor = 'url(' + UI_Resources.gif_cursorColSelect + ') 6 17, auto';
						return true;
						break;
					}
				case TResizer.S:
					driver.viewport.canvas.style.cursor = 'row-resize';
					return true;
					break;

				case TResizer.W:
					if ( this.edgeLeft.index == 0 ) {
						driver.viewport.canvas.style.cursor = 'url(' + UI_Resources.gif_cursorRowSelect + ') 17 6, auto';
						return true;
						break;
					}

				case TResizer.E:
					driver.viewport.canvas.style.cursor = 'col-resize';
					return true;
					break;

				default:
					return false;
					break;
			}

		}

		return false;
	}

	public onmousedown( point: TPoint, button: number, driver: Viewport_MouseDriver ): boolean {
		
		if ( button == 1 ) {

			var resizer: TResizer = this.getResizerTypeAtMousePoint( point );

			switch ( resizer ) {

				case TResizer.N:
					if ( this.edgeTop.index == 0 ) {
						// Select all the columns affected by the row
						this.documentElement.viewport.selection.anchorTo(
							new TRange_Target(
								this.ownerTable.createVirtualColumnNode(
									this.edgeLeft.index,
									this.edgeRight.index,
									false
								), 0
							)
						);
						return true;
						break;
					}
				case TResizer.S:
					driver.lockTargetForResizing( 
						this.ownerTable.createVirtualRowNode(
							this.edgeTop.index,
							this.edgeBottom.index,
							true
						),
						resizer,
						point
					);
					return true;
					break;

				case TResizer.W:
					if ( this.edgeLeft.index == 0 ) {

						this.documentElement.viewport.selection.anchorTo(
							new TRange_Target(
								this.ownerTable.createVirtualRowNode(
									this.edgeTop.index,
									this.edgeBottom.index,
									false
								), 0
							)
						);
						return true;
						break;
					}
				case TResizer.E:
					driver.lockTargetForResizing( 
						this.ownerTable.createVirtualColumnNode(
							this.edgeLeft.index,
							this.edgeRight.index,
							true
						),
						resizer,
						point
					);
					return true;
					break;
			}

		}

		return false;
	}


}