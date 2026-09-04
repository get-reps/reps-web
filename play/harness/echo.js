(function() {
  var CYAN = "#9EE5E5";
  var CYAN_DEEP = "#6FCBCB";
  var GLASSES_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAADCCAMAAAAIGYpeAAADAFBMVEVHcEzPxMHz//IcAA17f37IxMOGgHVSTk3////8//OamJIdJx/8+fn++/wWJBuem5v////LyMj08fHh1NPX09KjoaCqp6a5q6vd2tpPT0/x7u6blpa+u7uvrazr6umTjIy1sbHb19ZQY1GWk5Ll4+Pp5+ZeXFy0pqe5trZyamr49vXIw8FKTUxgXFwKFxHQzMtmYWLMxr1bWFgaLSVUUlPi395sZmZYVVUkNSrU0M7DwMBRW0+WhYKnrKFmamCrv6RLS0tfZVedioh5fXK0zpB3bW6Qj4/W0cJJVEtzdmvEw7iMhofg2NFgeWCEeXnTyMJ9cnGLiYmBfn7Xz8hWUFB8hHbXzci6mZyBg3rYzcnMxr7Eu7VjaV7NxL+up6HTzMbMxb7T6NHSy8C7urC+trGclZCzraXFvrmSkorEt7bf1dCBgHWCdnXD1MK0rKqRgX6xqqS7tK6noJzDxLjGubeonpp8enKJh3+7ravYxMQ7S0PDpqdtb2hOWFHS08K/trKel5LIv72PfHrQvr7Gzr6VkoyRi4X/f6ajs6HXzcixpqOimpe/tbPX3sqtqKHKwry1qqZQVVTArq6jo5y6tq+Ef3eEfnqBgHh+iX3d0dDh1tChnJaypaKvq6WtoZ/l2dbXzsrY0Mmfl5KRkImSl4t2b2lycGni2NJ1cWuNgX6VjYjRysVjYlqFe3deYlzh3tOcl5LTwcJ3b2eEeniRh4PCs7OQjoqEenWelJKBfHeikI3Or6yXioZsaGFiYVtza2VUUlNPT09XVVVSUFBJR0dPUVFZWFhMSUlPTU1KS0tbW1tSVFNPTExLTk1HSklDQkJhX2BVV1fz6upIREVESEb37e7v4+T58vPdz8/y5udlY2Pq3d789fZpaGjQvb5CPj91c3Pk2tlxb2/ay8vWx8fWwcSdjo6nl5fPwsKIhITp4t9sa2vNt7hERUW/sbJ6d3fCt7auoKCnm5vHvLuJf3x8e3umkpOUiIfn1tfIsrPZubnUs7TLq6yEgYE7ODp+gID3jq4wAAAAwHRSTlMAAgEBAgQDAv8DBQT+/Qr+/f3+/v7+/v79/P3+/f7+/v7+Ev79/fz9/f3+/v3/Ev38tPwi/P79/Bn9/kj+NlsP/SP+MAT9/0ovSV/9vQn+dv3+/o/+Gdj+PcqGqz3jh72hB2pRuJNFxUTa2Vn6FeX9q4ukQ+jpYnbZ3Dr+d2A1mnny/NwsXqMCIuO9yMwdZM7L/uhXfZaGbCLzdmzqctnr8Ki6UC6qjZrF3cnum+yDU6/w28C49YTU3rP37+C3yfCyxKLFAAAgAElEQVR42uSZa1BTZxrHkxNIQRNIIpckUCQjIMRwlZgiWmMVInhBZSctxAuCirK1KtiK6FJ3qqKrVjpup8s6MtLpTGe2H6wf+sl+OCfHkwvhZEKGk5AAGe63RFhYqATo7L5viN3OzrbTdgET9pmBORlySN7f8zz/5/++h0ZbsqAHg/Bef5H/VxAFBQWqO+Uw7hQXwHh46uWbg+lMJoP2fxNMAIfuvd5auoCm4Dhkc+c4vASv7+99iQawQfxsfQhCDwz0XB1TKIqVSuVXotGYGIriWXngxyq2UjzKbI6Jl2ZVKJUqhULhyT0SyESQFZ97yGYh91WPH5dUKCsapPExZiFkA8h0iq2dVshmNOyWUlmer1Bs87zXr9AwF/r+Wm3xniLlKEVR1k6xUAjSLcpK5XI3cFOzssJE0rgYnpgTFBQkBrXQU1Skqr22sNKAFS0EgS/ZlOwp6jEDNCy2mAfYxPHDABuAJkzEl8bFC8VsiIaibKO39pSX1XrUIJjpFyuE1X3mblVTySMbxWKJ4/nc6IiokfHeLnuyRk1guhYdhqrVGk2y3TmdG57I5QsBhCCWWZqV3lR2F66Uzlyhvb8T8bJJb7dZg4J4kM3rUSPTvU4vG4xAAZnmZFPX+IHw2A1h8TxYCFaL6F7Jw7vbfvgXvhueuXasrPBw+wxltfG5sesOOk2teIv22bNnehKEHgYoAQwj9Vqtpxaa7d1rI7hSMZvFonpERYVbj9FodSuvBpDgOsgmv3DDmg5rp1Camhj6vbMZ1Wm1Wr0eAsFIsoUEJUAQgI0esIFoer8P3ywSslgsXk/W4cKyYz7dHnSY/tfyC79aY6UsWYnrxu1qXKfDUZQQyOVaeWaGadOmpKQcEElJm9JMGZkCiQTDUVzXom1Rm7qjovlWThDb2nCruMqjJCvJDtCh8m/LL3nU08mLESVGTds1KI7DtEskcrlAlpAG0PzAJgGwEeBophrFtFqdxrk7IjUeiCSL31BSug26Qh9Ew6DD5q8qUc5QVBw3tFtDanU4LtEbJbK03qnBiUi3wzEwMDA87IAxDC4dLnfkxOBUTpoMVAeGojia3B3KFXKCrMIsZTE0BDtXSAkwmNAQK9IrOigeYDPeTBr1hMFA6gUyE2AzGel2OSCaBTgeNu6x9ZOATUKmHEgnhuHqrpHYOHYQhxq9VeJpjwBf035obIqPttvM/Ohcp1qn0+mfPZdndk19d3l2wHXpdHXjibKTp07l5WV7Ii/v1KmTD25UNp6+ABbvntgNlioAM1Bn6FobC6ZBpzmr6RrDO1L8PRbYFHXYzKLE3C7Ixvj8uTyj9+zQvMvxzUenq2+fUPybTR5gc/L+jRO3q09fcg04Igf3JwM0KKrTJU+HpwpZnWbRHigDSLAvGT8GLfBxU7+F4ifutn9iaDXon8kT9g25Z91P3//86gc13u1PXd2P7qmje16l1OR9XFp/4YnDPTSeIJBjuA5LPhgbzwkSS48W31wBhhCUMFL2Zb/FGhc90owTalTfJs/YP+R2zD19/8jHH+zyisSP0SB1iOc+2qHrpR9WP3E41r9IypTLgX9GnaFhLA4rRlm4Fe6afcTd0IEc5RfNUDHcXDuGqVsJCbFpMNLleu/8xeyQEG/yEXow8z+CTqe/3NuG7L14vn7Mvf7FJpkEQzGdPSqMw2HbHhWeBA2E+LP4IzREAYRxNDW0C9PiBkyS6RyMdLvrj1ysWWCDQDaB/w3NwrpX733zyJ/AHUP7ZXIJjuk0B6OFHA6V1ZTvI90Bz+8U92bM0sR/tuoxsEJQ3vNuVeVn21O88sBk/iwipvfIKGTXlcpGt3tyv0wC+qT5YKKQ02luSPfjEmBANvmH11CAjQZMcm2brHvI5TpeeWXXQl+AxP/sLAdsFmbgxkM3VJGuiakE2GDN3eF8Ntvac6/MB2YktH6Koh4bP6IbxXDSKMiZnHXVn9jh+eOqVUzGLzvVYTCYqzwDYcfVcrfruyQB1oriXeFxHKutLx0MvEB/zD/Mbf69drM0ohdvwbE2edeQy9141cuGGfDL2LxEQ9t4/fYFx/p9GYLWZrXpAFfMNnekg0HwSjdLDJD+x0U9ZlF4F2FQYxLTW3Oz1VezYduDBf7Kb8YI8Jhl2qFPq13uFyYBiutNUXwOi6qAnsf/3GAwjakob7cBNqRep5cnb5mfq/80G8giApP/K9EE7IRsNt6/fcE16ZSpDS3odLSYYxXBEnh1cwB8clVTO8UPtZOEgSRyJma/+fqQRxaYv1k0mTDTOwouOCbT5Bimb46ScoIsFQWv+VsFAG2+drTPAthgBNEmT5pwXT7hMXz03/rMK8CD5o0HKsfYPpmcIIlpLotjbVedeVVWAJjQYwX95vjXu/QYYcyccs82fpayCCdVnnWGXC8fXp8kx9S4PRQMAsueWr/aDwSANRQ8scS97sRRg1G+/7Kr/vew9+n/2xPPAM9TwXfO/cPxlkxuQDUHgFU2N5S+GpcElnjtXodt8zhBkm2Cs7NzlTtSaIukRwFA70K2qp6M5QgMGtQeC8SuoRiBu03/CCiN6TOWzdMEQRgF++afntsBXB99MQ5vGPB0bPuRS/2DGQKN2hQVx+nsObp1+UckQqdtUzksWSOEHmszvjs3W7nLuyNYLAMNfv1FNeDuFqg16ulUtrWjqAx+qj8EQjtTMmzh5xpI3Ch5d979+fZFZQPNVcqDj/qiEnDQHRFCti21eC9tec+FgqG/nemISG7D9Mac+TmY/kV+jsuoAzLwTknDWJI6WdOcK2VTDQU7/cEJgCotO91uiQa+mARsXH+rAZ5/UdkwPAr54FLfCxmqxpzRLGuHsnZZd4SBtJuqgQ7uNGEg2hLenv0WpD94CQ6nA0CdffFl31ACqiFMsSyrBWhdoK+fCYDvfN61Jiz3E0OrxDQ0d/sPjIUN4SLvv8DHhDx0uHJ0BoI4EMc29xUv33YAuL/aO+38UA3WSgq2zDVeCVmc8fYTZur+rf4pgcFgWBvPtqSW0up8ugIAm20fDvfE2o0EiW6Zq39z9VLlhQFUoObc8EQC2Yo7N3B4lqabtJ3LYpLAev78x46waSNJ6nPmLkPnv4SPpoAKpJQ2jKVhrZhzM8u8pmSVL58KgeIsq+7h5xJtxudpl59eXL2kbQlA5L3XPyJo1SSH8jotj6poyDJUQB3tjGrAEm0nDcbfvT37dc1i2pufKrjs6vbBTBRF1wHDU3SGFuyr+afTgvOHLWHTBNkmPzv/bTYNWVo2oDveuPrk7/+i7tqforru+Nm7dy/DPtjL8pSHvGRxMbxdQF2KPHSMBgpGB5r4aCYUJRIRK7WjpXUwJtFY7U5iqqOJTidJrVInNY7JpKNZdvde4F72BcuyywKyLFYeoYiC4KjT3tXpdPpDZ+Sx9x7+gTv3fB+f7+f7ON+TSVOa/kBcdu6nQuD1NrEA5Oy126QW2mJUPLlQ73X1v4BV0flLP6bqSN24Eu95521YMQADufuGbMu7aTXDjMoaRSzIhvGOvAr39EpSY47Gxba0Qi8TAb6Q0f+Ma5iwqNX5T25ks1SdYczaL81e3EKRAym4mCECUFJBAfj9ycF4qdaiNkx63J/HxtCGhw2eeickXZtEhcskjp25XrUABAGVe50pAwbawES4PSyWoQXA57OLCemUuTta0uV8AwAUQv2/W+VWlrbSRNa9vx9MBmzZKEOUY0+7q9Xd1JQStx3NAYVepDiFpx47Iyi9wVry5PtDgMdiZY7PA+XH3aM0pV0f1uV8MxbAVhhGwXu/ngnsNxJG+dOJbay2aIQgeb8rPMtM9vpLHAcqvcaRUH7u/j5nJGG16lVPbmQAlm/yCEH2n23FTWTTVDzevisXMgsQgI9DXCmjDDVWPL2yAQj57Bqf6KD9cTpFUtESh3ujlzAARQtP3HUE6wzWVx6VXeOgC8lj8k/39FqLrn8Z3n46F6qqoJDRvzOll7AYig9fzmBdNigCNrw2mEqTliBJe8BGr7BklF+4v88RRNOt6WXfr+GkN4cWgl+l3GsjyX4lZBjA+H+C07+XYKhx2VciLn6MIUlpdgVBWaSSLtdGIFz4+M8X7u+zSQmyKfWwh+FyJeiC49HpSeRoDO7YFQsNE8Q8+l9OGQjy0SMmM/bh5B8QUa17SpOkZSxgZuExAOEx/m8LN9At655+m8Gd7wlA3vGH8iRtdyA+cnIrJHdHMHAswRmtMxrTy/LrAVeXnJkU7WbgJq2ZDBd32RfcAjDA4L/UaLCue/p+BhBxKey8nQ/lpIaxANubcFSEBIz+bREaozW9rKaew7jEWMCxAE8ysF7WaV/gKCAEp/rCgg2tJsXhMxzn4BjwS3uYTqt7QyUjr8NgAR7/t61KarWmP/pLPae8hC8Av1Q+2GJWlya2By4oBjD6/7EzmjCYMsvOcH4r6bkFWCz0aDzueMOLVY+Xzk0+vDAS09vk0X8G17y0EFS6HhBUU5wk7FLOwv0Mw3H/6YiwGKyKsi8B93s8UOC3a0UWqelfKrF9wjUGoCD3c5dytMkof1Sdx2Vs/I+qdodKl5BEEC67enahLIAHyutGUsyEUVF2PQOBgHljIPvA45VJ5HCiJOVjbi0AQYq+di8bb2mV35ushyEvFYLdAXE6iozGZTsLF2apCAYK6gJieonWzLLLGXBkXgwT3B6y0kzFiWXb3+XylxAMu9HXPmw0Wv7RUA9HXYIH9gRsos3m1bhtF7YQ08IIlvuRe1m/gbHxb0SwZN4YOHsxYaXZEiRxVBRx2BoUgCP3ZUF6K6GCRf+embSbAcUWc/cqiat2Af6JL/T501D8v4xGTX7DIe5j3H8t4MOLUjWlWS5x7uNO8kwCENLOJIDGBhU0+vfkAjftAxTZq+x0vz3/xhDGEMAwqX6staZhDUz9FybWjQw3EVQg7tzI1YgQAnLrnKuSWvQlqts+8Cy54/uCffZUUjMe1jm0e741Wx66O8GxmrZaq2uuweP/L9B3hzOTIMZlkqu53EQmPib82h4/0GJVqG5nIxBdWkF8Rbv6VpK6cLz9JDa/2zR8HvjOFd9rtCryGwFkixx9wet3syy0FO9JEwm4AaGDEe1RzWPm/B+y4RpQwcCG7RMtpDYCd9TODwJQcPChuFRvTc3/ErpFnqiv34EQgqJW4M5aLnJBlMmOwqJbTFvy/7oBLnD0WMCr9k0GqluJn3sPwebznZyJsMgWI62qzoZvCOsDpOBilJoaVfbYK9lvTyLCtz6aCSRNeg8BFMImGyE4HzBg0W4Wd1WBuVcDULToO2cM1draoLoGm42/OOUxJ0N3hxPbT7/Fei6IgU/7wqZMd9blN4qg0z+TCohOuOWUJhifTy6IgT/2dU61Wj1nhHKTs1D0c88pI8XOWrYhgAfKL7QHG0zy/OuMuOETDcKL/VkCQZIpXUNzbgpgoCBIFtmkZ0iOH4RTuOC54C9NqC3m0M5zOSznqGjhFWcgZdSpGrbxoVxc4KEBxTTdH+aoKprb3AQfjb0yokxt1qiK18Cpf+aUaOVMibppWNyZhrHKA5kMYEj2rK25ZLoRVtkIQa1bbiGCxTOfzM05MOaMkvUd+ur8W7Ce0VMNqB2UW5oicNdv2QwCCHK2TrZcZzRP/5CBQSocPi/5aAKhNocmXs2dSwsPAbF1Xf4aU1L+9WzUB1YDQARFr02o1b1hXUeLWBwQw8D7rqWj+pbJ4kYA7eYaDJQPblbTpZKlFXO5wiEAB+2yfgYAauoBxNt5MFBpHyAJKT6ykT0IwMDZBHGQXp85fdsP4ndOGHgckpPkasmqnNljOIJsrUuMNJrMqtvJMD9YwufxK+5bSCpGvOILFGMRAEK1piU138YiKMTOwcve/kCtHZC1742ddTGAOWPAMnPH2pqSDADxGT0/us0+TBuGJbZ9bEEAhpVHy0pNY+tUv4GxPPI/ebxdodVE4jNHZoviKBZ7ITHIOqaYbuRDvp6NxwBdFkH7ix9+wVKsQsCNkRTdWLrqcjLc79vwMb+9IbQ2M77rwFYUnS0AuJTdYxaVYgPwgdsA+Dy/v0W9Ypjqsu1DWLmuiiHlIZ2bx9YWT24DkDsHBnbf7ad1UknoLCcDUKQgOFHa1jo+3Aig38/oCz4blKvp1T33c1m5k804h8NfZ0xl0mPoZcMDv7uvps2hsr1bZ9WwRsA3rmXd+qSo6yIE+u2MKJa8Xao2bO5x7mCjK4OCvJCeZ3rdZM02+A0AQwvuPlM3xYlDT6GC2dj4oQk8uLm5ergeLIIFrb7giLvbovXHq4pQhA0A6Fylbc7Mv4UtAtkwEDAk1ySFJp6cDTpiPp+6wno70qev+y2G5zyRD5KPPlATm/CRU963V5SfFyKJ0rdNMgwAhV82GPqqu5RokeKBsxig5wO/Oklkc0fJ5E/AotjQLAS/GOymyRhJlZ/XIUAAzoyEkh2pUbdEi0I2PHCiz0J0L02sePmnBTCwJyVswLSlhgGARfFYBwJiq+KIljg85ry3k1YE2/p5YrhJXzx5aHE4x/OCcFNbJL6i/GURi8ker8giOkwKVSN8oy7/DwJ2DGW1UcrOP3i7GISBr1YpzXeypm8thgDwXDaiiuVLWgdkjv0vq02Mobld43fa/k3d1Uc1dZ7xN7nhopAQiHx/iiRggggika8exC+GMp1S7KyC2KmsWhHXaeuxzo06u1ass0i10q7d7HTOM2ePZzr/2M5J7r3JvQnBG5MmkRBCCCF8CYIRsK663Zto/SgtaI/n7P39wz2QhPu+z+95fs/7vG/uU7OkGJZBoiDfs4IgwgW1f+Y+V79EOEFnDdMH6CU15QgKy9wcd7VpqDzBltWTrFsz77gditMZC0/9fxc6HxeBg4OFRH+0+fDzPR8aCIojTI4B5dgFWGYGINygLcJZX/bKQid7aAYFdRYhrVlxKx9A06QD5b7aJSWpENuRwOe6bOFwj7WmK65I3f+Gp5v7YkYfk5v1iYYdk1u3otziWoPUmFl0BhYB8N41sv9moSaGn7fmaVjLNu17ykrXLouQoN6ugcg5mBS5p1elDOdfXDApizIKYErHCUdCAQ+iLj0csN6VrOqPN6/3nzoZu6N+DO6/kr30Q7mT8GkULPVEO4nkhRdQiJyDC9YNaVU3ZIkHJpcgBX0qEJJlq7YVQxUBwCLXrSYsVbA7cIJDuly/hwyZweLhn6b6TTBBfshmQ4hCs8T9NwCRcywGBzodH2gTZZPaMA8ABakipzG56AKAqWEns3Y9FJGFJwlSv+/7kBxfX5X51dUb/8KiouKllyoq2asNG6url3v58T2tV7ggaJcthlCVnFuAQOQcCDdnZ8wHyrAptYsm4dMo+LAvFDOuTNgLoOrbzAGH7Xplm0S+/rvWAajv4ZbVjY0VuaGtJhs/eIrNxufzBQK+xdSSmJtb0di40ftCdOr4QYSDlKdG9xuTk07DNjcnhzJJh0z+m4lLAQjwv2wJJ3QMyWFSAHaTbrV9RKPLE30yrndyUW8X9/Nrt54w2EQiUbxYHpkbkhc7MzYvNT00UhItE8hsfEvHZ386v8+rE9xxo+M75nSd0ZmQDxcBUOTznv4BRWh83fIJU14eyB9sGaEz3WeWw9W4ncfN2T58xZgkSx3nYJC30/q+n738R5PFJpKHxCWVOtv0aWoFjusYKBXaNkdvTFy6WDZlis1yYutalgNT0XH+xb8swnby1q3VkDkHd+7OogFjmCUuYEJdR8EbnbnaAWnC3+Eiua8cfNUojQ9988k7Z3fC5/+o8prBZpHnCUesapzS6SgFplZjGKbwAccpXG0dCUuVyIL55o7KDe9/mwIoKI6IdrSXJVyYARCo5sYP7Jg+ix4RhRyf0KoBYLNhuoYorYFMAbzL1y4nUZYeX/f4ILlM7J//k4rbJpE4dpVVpVEq1Fq1giIZFBaSJMGA1OEMHbRqTIFj1rtxkTKbxex68Ze+5uiPRtKCzkj1vQz3qUDInANF3uzJIPQSyeaJkgAE5OwyFdGqhG3QEQABQbVFJBFuSXn0pA5r/t82vtdikuQVWRWUUqnEcWVh4ays5HmO0pIEt9udMNa7YuW8jMyoqFlKnIkIOlJdOlMisJg6nqQAB5xtiSXbV/T+Cp4a+YM7X1DbW4iHiF6fiLo88JHH7KSt3adgUwCWANunU+QqfshrD+8dRZis/4SNL45zqK4omzAlQRPZ0rHhQXtXl91zsb5++/b6+vpBj91u/2p4TJpJkRQjByTVJowMDhbIKxkKBDxQTYQTdISfZCxM2JYDmQIwwj97dwquCbMNfzSBXzMpwLRINbFt9DQsO8GPCl1DeibZL+qoerAQ5HIAp3GrySYP62dEXtl8hYjKqBm+bt9/qO5S1ZryPXPvY0/5mqpLdYf2X7dHjM2LInQKJjPQJzEUEN3e8O43rTGYFKDWNkJrY84A6IAG7rAna0ZkQxNVAvyQd0x5VHPJC8WwKQBroM9dUgILbdl832RM9D//41aLPKyNzfd0NDlv9Lq9/vLHBbN9b3hy32j20o9P1g95uqVRZJNWq2ajgMDsalh8vyMnCl7rk1gHpN2noYuO7AMNXVJSL+48NsG9+4GDAqGxyf32cqjqgA8KXhW9RmKmbZfXXrypoHpdp0kc3tbE2B8vzHzhK3vK+gKv1TkcDsqAx+P5+/vzeOw1x6f2gfkNc1wed0YUxiwTrTFyQcvtn1f5urP7gSpLepnx7sIC+KIjD5R33SV06a3/GOcYA8e7MeJFwCtBh2yltPbmmUDYZM6rdFtuEnQMf7fPX8GynbfNsU6lCsNUSumw6+LJvXN9hb7vGBrie8YAsnTHzmuDK7Oy09R4mjCe3xrSEMR+HBd8YQunSfe5BfBFRy6YMRhD0HEtX4BX/B6C58sQH0VOrbmflt48Bl+UY9va1A1G0TcsFxcBlHH/DS5z4iq8WdXUPEv6Vmf9pbnjVnfGJUHOxkrX4JIyJhfQtcXyTdN+7+tXu93Ue69s9J8Q+gaTIX8aQbaXGI48vn7x7ou9v2yOD5sYnHVN09I3uvfCF+XY0Ry26wes0Z0H0MXg6M5pfTPbmJy++cvk7q5P9uaw5eBJyRqCsmNfs64rJYPEm1T4KnFwa8VRgHKR/S3Se8mjFxAufHPDAb/wZNNOScSRTXO+wbp3we8A98VQs0FksYhE8ZK+PnmuxIMTJW4oCYCCKpdToxWb/wDAxohrkUXqpquKK7qa/3jNjz7FFzl57M7Bq3Nco1kahYJqCwk2DzUwv36vI/medHQvjNExgMkCM2itWB5vschkfJmMMbjJ9NkyFGzujBaLJfESiVgsj4yUi+OFGirpVj6Mg0RBeW0v1ZTecnlpw82ePIfiqlqhk3799anZz9DjGmWk8WiFfQmhxBTqMJHB83rO8Y6QsvYVo0vhnJs3ehw0nieKjo6OZ8DaW8IXJR4Flw2x/U4W/W1WfZpeb9VSWcJzywGM8EMqhVHNM83C/8akxOgVVzE886d3zuY/YxtvRjBydriGs3E1Ro3IE8PO/tUwRJEJsBIgf6iExvX9TocXTvZnuED2azAkd2JarTZNq8ZwSkdRSpxMCzsH4CQAqAzPIoSGGOvCbTplk6J55Z23Tgc9+3P8GEOvebnTSWFNOuv0FEdJyzCp6l5YDiMBEDCjXmikFKyttWoGaWn6jIxUfjjwhFjVakx9FcMUOMXYX4kbM8LPwJjnsATYNJg9UNoSM89KExRVOOaq2/ODetxyA4D/2mnuKBzXKHuld80JRnXKubnwrQK92JVS6N30whgwFtemWfVCURjI69FjbJ2UMb6O3SEjdbQz/BSAlAAHPZl0f98w1U4TxqjhOx/6/9BnnDOpwL6OiGyNjjaWuVtv0NYISAnARU4ORZE6HYV7oWBI8D/2zj2mqSwN4Kf3lmt41gptGdva0gLtpungoCJ0VkdGZDUEI11I3IljsonODEuCjzg6D00gRmejG9fdGUSjM8kqMxlMNGzAoBt3Qsttb4uFi1ylFain0I4UEOhDEJOF3XtxZjKZZEs3w93sSfb8wZ/0nnN+5zvf63xfr1G7RgQeR7vYo++kKKfLtRgcpWiz8iiKUo4D4LAhl+7NlHVCGlZ+LLsJluGdUAJouhTMpemFhUhWAfROtRJIrg0GTgdzSe6MczkwDpYDa5e9IlsEovr7FsfLqDj3h2FIWCatQRMAAtQF19LWjJCVhhv/8f5H3znxfzYB6/4SyF9YWJDmGeFIqBXNtRGw9p735R4vQuDo7LBb5zPlIKS0vcyKeLn9NM1ALboAXAh46c68qBEaX1xft3x988CvA+sXoFpsp2dQBSABfOrxsRcjNzgGXA7LPdt0EQuAxEJ+f/4ZDgAaSlAFQACuBUZolyHalf/ieuHyzUGYAN56QS4oDFamDFUACHDKP0Nz+7sIgJNTBhw+hRaEVN3kd3KBJYCGkGakEmQB+H3QB6lotODj5sLlnAKWAK7qtpiiVrJU8TWqANT4x1jxDjkESFYAsIPyqprBrSl7Dzk5yWGxuP8QMmp0AWgKzkAypN/ZusxtfFcQhWd3KqKVlDz0FbIABFQcAJADYMviqJyPHAfnxgOR0cURGZ2dfb6Ngi59ZDO6AJhpJhT8pnC5J7ACFH4jDlVSoqmbqAKwOaCdpI27nj+Rj0a4LZfLZZ7bVQCcqv7w+3Hyz6NhO6xUSBAGYIymFOILyx/LSgInitQOpAEIamn4TBU5eZLbam58eGb7y3SAH7w+69qjrBllQheArYaKSadC3IAvOwAEvjlP5qJEMrQBeBK5+RP3APhRkFwA2vJGaLtYsgNdAFSTLoWhYfklALuAeTqKlCAsAaIsABFlzQ9rg4Gf1ozBVtzx+xgjygAEVQ8cCtP/Afh3AEhjenkxcMczw3SJUXUFszqAWPugW6H4ihcAxBwAob8jC8BjOc3I1EsB8E/GKlaiawbmaSc7FVO8AHCCBYCRRL9GVweQ06R6SYLalfYAABj5SURBVADGmA6xHl0AMrSTHSYZD1lbQrDdoKNoSbAVXTNQTrtCslgAJIBTGRWkw2BCF4As1aTVFObBisHAb+tZAESeVnQ9gezhiEpjAVDCAlBKsXY0ssGgY8NldJdp9AQfAGgUMgpqh9uQjQWkl07aTeFYABDgaIaIYvRFjSwLSE7ywqAZ9hr+Vrz8bU4wkHZkygFV4204qtHAuTK616R9PcbTZs7UkbhoadYdVDOCTg/6FgoMvyxf/rcb7D/c97QSzvddRTUcfG7QTBcY7mpiVIkhwOsmqQuKNtxdAdCc5NnhgoUR0wENLwCcebwRTvd9oRHgCK4Nxh0OOBK8HiuhjQAfqZUuWJFzGyAKwL703IWZ6A1+JMDZb3PpkTU6JLOCWQAOD3rhTkNzrAJ3uCCtWvEKnF4j2o5k4iOR9gf/+oWK0JcAx3mg67NAATmQY0DUTQo+SM+Fz0PtMXdWAM6L86E3R4/k8yfWVL8VpaBoqpGPh21J4HP/Lqc9048oAGn1gUpaLvsSfBILAHx/UQHsysm7gObbwB0BGU3qdMf4+HoCXPt2fkuHePgaoi+DAiGSlOpie/kTwTsZPqYzc7wOTQDemxNBq3qWl1AGAfY81loc+v4GXIDe2iSB44M6WKmMxK6mToBN4jLSaXLvRZHyRHBqvAIOhO7yUsOLvWDqpR1OibsFIAlAXZ8W9urfjA2AEKw7EtnSI015X4OgJ0CAt/RPQ1+oma8fqI7mO8vcteXoLQ2O4S19Zm5tCmOWuWbNgHfV66mKleoqBAHAwAfDa+mxqXZ+7HQMP+gZcE70hxDUAjGQdmW8AJaF2pYuEhXs7fGtEiOYFIZjxW8HKklO0eXFhk0Avxr2Oe3pw5fRU5AwoIlmbGTkuoalAMBP+33O3uzBY/w2X+Lnmmsc1jEOaZinUFYJuJZe5nQpHrag5wkkwPH0EOnQPVmqwNUnoMlfarGY3C3JKNbC61PBLqWKJxHNFYqMWChJ6nkUdcD9j+TQKHuzaQkAhKA4JLU9kA/VIqcFcg1v+3zwF+r2cn68mJyf9KndZXYr9qDmJ8WwtDOPdsIRWbNmqcoPicmvmboe+FaLm1Czdrli0RvymWdS3jI2EsFhv9fSm52FnJdECApveYx0hW5pB18S+Mw/0ZOf+Wg/akpACWjcYKJcctFRvgL2BH5qbt7mMLgPonY/CvCadAXlkESWTpcWgN1FY90ORep5JDrH/3h7kluGRHR+pOIiXxKAAMUBiY0SpagR6xjCHo6rOXKmV/p8afUIA+X1UptTlVq/FS1DkJVy4b5puC3cruGto1dC8mvB++TIKn8Tci1janO2MbuUN0qWjpMn4m8Fcp3e1eN1iAGAFwcy7MyBcAN/FzSrS3u8ZGVR32HUmkbVFGVUkippPGGMJFDn8Tk7xCln0DIDElhDR0o55CoeXVgYqPKPMYwyVY+WeBSAtj4lXSnSxuMhEYLtj+U2iyjV9B5Kk+TaebjN9EDk2UX+wMWA5oiUYuZT5zahlBmKY5orbjMsCDeviG+WZ0y59yZWr9mLJaIzSQLfGsg0kjtHW5MxnEcxc8ifS/Zmuw+idDgIcNyT2UWbI/Hl+pbg73imrXZxai1AqC46Aer69E6rlt8y1wTYUWTeYtGvPPkGSjYSdv2RsselnW2MC1shWFcvsXdoU4K70dF1May41j1GFkRuFPNM7R/V6x3zqYOfYsi4SXCQpns0MzkgORCn5iLADwa8Vm923yF0fEEJWE36BqNrbPRCzJS3nz0Ssb3pEzZjlvs8OioyARo9RXZyPhyvi5QAm+bK7nXqh6rLMVRmiYGrD5VUl3z2KL/amRC7eKn0nkWU8tcqVMop41ja7YeiHqt8dnecAAixV9+eut89s3rwHCqqDgH26Pu3kSORZo2Q3xtAAN6N2i3enP69qLyeE4Kt0f6JnpFwswaL80ovAZ+nT3R3FLmrNQQamCcRDf0KylUWaeAbWQH+abrP5lAPHUElZyop6XS/vtumisTvIROCKr/c1qNKmbuMhghg7fPwQzPMF6l2Yzx/MC5I+430Fadv1TgiIoAVjqE+3+RA5Hn8AQxckLwvkHvPmD1UjcY7OO5ZeJ4D7oq08R+mSwCHPbm2TkNqfRUKGhIufLV50OSizOE7yfHfjkLwxqX5P9kkK4cvAwScQZhQc2VVKXQ9V/0XDFdMWPy7UptlPhUNI4kAO6ZWj9EdWtXu/0SaC8C+p/n2iZyh2nIEnEGJ4FhWZi+9drY9DeP/a5PAIVY82jNW1lcJ//f9JP+i7vqfmrqy+M3Ly2NISHyQCIgyCgIi1AoU/EJBVxTW8sVFkEVk/IK6oi7WuqjTXb8wuiq4s9ah03XQqrRW3e6sbltb28rsDy8vvAf58mISk5DkiSMEg4rAWBTYiuPe7M7s7M7sLyB57/YfSO793HM+93POPec8XHWCX0zfzu29NS7fILC13ucsHe6nAOTNHCdiz3dMMZkKRgQZboZjy0NXU1Qe6f4JdM/I8f1Djtn9ppGRd8YXH0tA6lCCtTO+48MiDHUK8CuADI9pwXCNMHQVDOoeJtAWDVQBEhx5bH7j1Fj6O33XF42vYZoA2eoSKzNFOXpBijgF4PVNkAB0ugLfFRwXwgBwaZN3tZGeqXRuQF0hEdj2AcdsjikYGXe7tyQo9YnBaoi5+1vU04EY+DpGY2nvG161UiBKloA6r4U1hN79qgFDu3JWDr50L7bou33XY8erVyQgu7mkkVsd4qwLQpoCcPBOuLvARI34rgT2GeC/sMGXNc9uNA5Guf8IJCh7BwH2H7E94lhfzgTmPchAqTetkUomF2ejrHVwELuaH9K1dvc+W4kLtU6oAtQea3s0vCCRxkai+t6WSOkHh1ctw8atVjBs6c7ZDHM/rKM6FmGtIwNnHsR331kz0yfgF+8JbJn3aSNjie9IbkIYGwJ82xPX10r7fAeDFBOBNt+VYmXCSXcduklPHJSdjwpvu5M7/J0CxwSEdgPfZzRPJ2116IbJBL42wjal9U5N7y1F/QTUsbReVfG00TovUqlBtzqQUFziIy1ta7JGlgCFcH8rlYCKgWn+bJB6C4YqNvXgUtdiw23alzXBuWYE2KYZpKlHStvvyxB9FSTAZ0MdBabW3Jwrwn7Pk8COqQcbqedJHTsAos8lBDh+z/a8rX+Vb8Lt8jLpew8SDPQs/yWAJNHhoOmibQZtYrNqlglcvgZDwZ4EgzWa5PegSY/wctwXFs20enw1b2ETxAaXNO38Id3giVGqtyBpAXLiS3Vkn053NOea0KcgDQaFU9MsHg2pqUVRIknl8HKM8Wi1u0cOTpwcIYuMFlvpwaiOXy4VKsgeV5rj+FBUQXt7bs6Nt3Ch3TAYbFfXGAz3ozrWN2E4gticSY4q0XHFvhuq11ieXFrpTTBQs5WOiqXIFcBIQPb5+Oh207yWrLdFqF+WKN5zpVggNu5qIEMNGwJsj3BM1ek9vmevNdkWxxZ9FcGwukTSVqmQoSV2MKJsX1co22rK6r0qRr8+JikqnLWQpRKVfCVADBsCNO1zh9J63Yjv4Ov5BvQyvkBrhLEg/xFiUxEk4JI3rtt+e27vd+KULhJgubpAZ7RolF0X0HoVwoiqS6MZffrW4h9ugdfsYJGBDc4FRuZ+VAhiQlAGfpVsyzPfZoevx4rUwCIHF9QLjMbBKOXiY0hhQ4ATD9wlnD2l9y+L6l8TG6lM8WlPmoHOU4a5tiEkd6E+HbBFa/v1WTmiTbSD2FQ+SDNYITafZCOEjUz67YBtOmemW1omYbQ9JpEWDiw0sFNJx8nLyDCdHHwW4cykza1Hh0X8jh+OxRZGNPqxcf+1AZkBshAb6BvtXNvuyRFHBNbU/DTdwkaTjvXLEdklARrefayxmPuLh28sIoJEXEeZqxdawCyl+3QZIqEADABu2pJpU2tx+dcquXRSfnHb45npBjaRdO9FYzACPP/3RyP7zP2e4ZqVoq5IDj62FTSy1kzSVo1GbQABsuc4NRZta0r5N0WTFLrLwM/dqyirIZl0VMsRsAACLN3nirtv7184vPuQkG9A/zcftNk51whDAdJWikI6AAaAF/nITsaUVv73lZOGTRX4gs9tpC3zSVtqmegWQIBdf+h5/Nxub2/xLRG9gz0YnFOnGJnOGCQswH/+o3wfp2OGhydTHFeBX4wuoKyeUKgDLosc8ayA939P/Eu7uS3n6TUgFz0DUwU2uRIYvwW4S0EwLvL5N1wcjbvPMe0t5UsmNW8jk5a6UmjWkkm612eLagF+/ffAncdpW4+WX3uTED8LjwWrUh8uNFIejRJygKgqWeY/f3cJx+izDlwLmtQZJlIJ2OhKsVoNM0jbyS0iZj5l/vPPWM0Z22rKrwAkehYwoKp4mG41+jmgukzESBly40V13CuOsT87cHWyRyVhEkWhy2I0zsskHTH5ohVByMCpd72RL82Mvqb8czEDwP8lpWUnh9JZuhMqwYpj8E4QKyLJvjgaOcgx/TVjxyf/hHBMVei1UPS8RDKsKz9IHPEFY5wP1ZGD/Vxb8YHP3wSofN8UB2U7M9OslCWZtJ09LNItIAG1N0c1fXqdvWbsaiC0kQRTbfSmUKxhakgSX1ckAtVhBPggYjSmu19v/9f5o1OJQ0AL8CZQFDuL7GjeDEQoE8QwcOGmc74H+v/RsSuqgGhj6PPrXHPTDXReWAh/epfgMY9EAj4a4EM9dj20cXj+KFVhEGDRRpdFa6SmKkPcqVLBvQNa3IZ7tkwLYzQfHTujCFCPJLSyPfwqykA9z1Dy67cJrHjhHuu8zkSr3QxtHCn///fqFKXqBT9j6elJSkdhA6gS0jukMlC1tccRbWQofdbYrwOn0GAs8AU/QrG6zlDSffZckYAWAPd4bKu3azqjN9tzxs6okBthiGPgHF/DGOiXGVAI5AMBDRTDQfb7o3GzOa32jZax/QGt2wgGteqn6ZSODk/q4E8fFmybkFJrj3TFvNJz5jXlUOMgOLZCWgU2O2emG6jOTGWHelORYLEyxCZ/L68ZNDPcmvIDfwtw3Y4cbP9kIE1rND2KJ23q0iBBSACKqqq6J3xyH6e1JxwoP4RaBdZ/YtQPuuYsZGl6elSIs6IWCKIEoDI6tfUen+jRNuoTDux7O+B1WxKg+rNrbjvLdIeSSY8rDoP6gJMA/IPaHeqMqVaOsc990XII2T4lGVi7816CjmUGNUq3Zl0RWFEvADb5e9XqPC1j1Oe++P53AmAD/6HUNTLNwBqmhJGOs5UrAvwMisvArs1DvOaVmePsu388sQjhhtxgoNjoKuZYho0OSbLthFekHAu0+1f28Jndei33RtaP3wgjjTEJ+Lh5IIWeR0ESCOuq9nNd4Eb0ywDYsmO0K9qiZ8zTep/8SYX0YB4CqPaop0yjqPZHceTdrk8bQAAfTnB4/W5ez3dNYSE1Liz/x1WhsJEGg8uFrpL0eTSdF6d0qFNPBcwE4IaObepxzi9p19LmlLHzSwCG9lgeCMO25icpawzGzhlK8u7ZdUsDJQX8rlGb6nJm3mesxv7cF1AaCRcaQdNb1zUngbJylvCwu87FpQ2BMAEsWApO7Tni5MP/Wd65BjV1pgH4cMuSJSEBCyEsICzIzSgI4RKtGhFRwBUtSoWOCig7K61Tt7or6BSpdlpBkC5DbXdbd6A4s7PLzO7wo87s9M85OSQ5h1w2SXMhIWS4JKHBAOIFJIGZ/b4TcOzuj2plC2Hf4dcJMLzPe/0uvEdFyBS8a+6vLiNrfkw/iI7grg0Ofn+/xBHHNujr4Ypw5QMTzqb5sNJmjIgXidUKnt3118yf9IAGFJ/u2oF3hDKMnE5jGyI7K86BZPfxSqvo89sPBvVRw2IZqk18c+FSkFdMroWJGZRItUqiYm1iakZO7QfRsbJ9EnyXy7mS3kF97BApkpHZCxd//5OXRjryy6sjnEShmBTFZ7HNmqYS4AL0FfsPDR+gYtU/rj/VhyzKcBSGP+hwveUFFj7I511P7RlqNTYUHZOqizsF2iQkf6XQ+IG2GGktKRvUb57u68OU3Dxbc+4q7IwAh3u7bcDOx2S4iRXBNuubKltXSs8AYOnW6vJBY9oRGSnCyZSFhduZa+D2z4uvB5E7ndbDR1FCClwAdIOnGnZ7qvarmx/+ktaKpkF9yBGxlpzUHnbN/3PrqpRGoM/PbnXaDvHV/SLTL+IYBv3YX07Dw/BX7AbosGlqKO0F5i+QKDEFyP6um+8jXvWiNhCke0oHktKFYkJ+PzaUzRish0WSSmyvFHU+FJsmvT6kQEKKycnEN23nVy81ApMEX7U+mOZL+mVb4l9jMswj9SU3oJ4/uhTQoIr0osoxoxGqiCq0/DxX0i44mw3xKgGW/k3b2HiiEJXJRmMj2YyJzq4iCs2PZeNHsdldvW1Ao4FsZGJlTp7rd38PWs3OGOSjvZXWqX0yFCUlBYJUtjmms61oN/yE/rJjO/18ffJhlO+vPjFgzNruUCsxsfLoNfc3X4AKF4R4m4AEGXzv4MBsolitFo2GZzEZhpHa0gsUtZf3Zn8aVT8uVDRtME5ELfYrFWIyI8/Vfjt3lVMjfBfp3boBTgqXQHHJk9gEBkMz0VQJSx5QNN//BW+m+fkGeArkhxXlA0a9IGwYJXG5lv+u+5uaTMS73mH6fIIMamwaG8+WSdSExLE5lM3UCcqLGqAz+wQEvOilPV9fnwDqxKWhpNyqnxCED+MKOQnYuC42QvOvdmcEyl3wZ3U2zmE+2i/CVUe2RzKZoTFlXR2tS0mC/kN1j06njO937kLlNqteNxK7KCEJlJjMed1jfpo/4p0CB3TnnuzdMJPNRXGpHKYBNkMzUt7V0Lq01Mn/geil0Zfotd7qOrXBqBtJdvSTClQxmfOue75mLZh/ydOR7krL/ONEPorK8fssUAoC2caRbaUVN6p+RfkwcGIotOWJtb4+IKfBB+AjGN5VVUWlZ3qeGnURURtNhFROKJWqWdcVaH4fbzX/0rYQdIGBpBSCkMnwLYvJCWx2oHkwrbKiY3eVJ7796UtsnoU8bemBZ0pzVdWvSytDAJuEzfFDBKiLPF76rDupZgeyZgbVUqPo91612MazuVyRCN0yHZYWCRRlxPyx52JJ9envdQ2UfO/H91eXnOgcMRg0guhiE0rgmHSS+84V15nb3m7+5T2bracPjs1fyxCrJSiqWoyNSA1kMHRZnT2l1dU7n98+CPgvODurqys+6BQYzMa45IL7MhITK3g5h664vry0FVlb8+lgg7qnqNw6VZzOV0tEOGpyhKdtApoaDKEjtWVlb+2HsvPzY55vD7p7owE+6DhRVlb2VGfQxEREsYZF0j4CJ7Q8k93tbC70Q9b2KOaXyQLI8TNW68xwhliGYnLRaHxyXCQzkME06wS1tW1FS2yWfyBoJ/Wgo622zKrXGEJ1WZvDnvQrlBhGannZsy7n+eO5cDmx1pa+QM+gt8+XjU0VZ+fguFwqxVRPWFFxkaAeBDLNBo1xYkLQ03OQkvKeHsGEXqMzGMyGyKyQ6PhpFdHX1ydVkvwUu9td99EO6FTrwfyeDAnC4/KdtjHr+D6+UI4TUqls6Eg0CBAmRGPWafQTE2lLaA4eLEvLotiYmebIBEEy6w0TSiqV4Iubned21dVcRpC1eSZCjWoLulXaY5uayz4qJUkFQeAS03RBeJQgKyY0lcFgBC4J22wOjdwUkbY9luUYVckIOQH62n9N8vfNul3tJwtzYSH0Q9aRUDtAe0su2izjhzO4PAzDCFykGnWEJYdEbAJomEw2xYWiY041RCa8FpIcVjyqEmEYjopJrfYPo7Nud3v1ruAVP1lYaVdHci+db3c+eHgoO4cL/njo7wQqMY1OOwpYYdGUhLPij7wxPNSPEnKpHMPEYp5Sy01/PDO/8OeaXVup7ZJ1ZX5PkQRsgt4/eeaRhbMxJYPLPQrQkHJM1A/QLAI04bHJQGKjw1gFjulRkwSXfvttH6CD8Xjq7OIkp/PLGmj9tZf7/0PyoQ9svftei8X6KGluXyJfKBQCf5eTMI1hYlxBSkk5qSRJUk4QGCYUKoX89GE7ULD9/Kd7oPXp68/6y4s6mCKP3au8brVw7NPpORCNWAzhADYkgUGHoFBBNqS0r29Sy00ctnNcrvbme8dyYQ/tDWz8qHtQwQe6/9bytc3mTIp/PGpKzOFzeTyQEFCoL6EgSaGQx+VnDD3Z+JDjts2fbf60MBNZn7H/PJog6s5m7vF7ze3zNifn4dz0kCoDouHBVI+CbIhjCqFUKQRsTJCN0/J1S/NHeyk2dO85DvH19yxmDhSePnnzbH2vxWpzznNmxu1zxY+hvD43O3Nl3mn5rrf+et3Nxu7LMLchP6f5r2frL2960ignyDzQ3fheS32v8zsLRPPQPjfngGgcc/bxh0lTTovNAth89UX3AU8TQfP1sp7Yj0ajL98Zv1zYeKfkT2+1nH3gkalYTt0nV0s6Gi/tebYd6EPzR/5fxJ/27Fgwc8dnAM3VT1qmAJdHjyAcTgtkc+fSrmdbCf9DNv8GOvHEwdH/bGoAAAAASUVORK5CYII=";
  var GLASSES_X = 64.87, GLASSES_Y = 84.66, GLASSES_W = 70.4, GLASSES_H = 26.74;
  window.__ECHO_GLASSES__ = { uri: GLASSES_URI, x: GLASSES_X, y: GLASSES_Y, w: GLASSES_W, h: GLASSES_H };
  var LIMBS_IDLE = [
    { a: [56, 106], e: [40, 134] },
    // arm L  (ARM_L_ANCHOR + ARM_L_D)
    { a: [144, 106], e: [160, 134] },
    // arm R
    { a: [84, 145], e: [76, 177] },
    // leg L
    { a: [116, 145], e: [124, 177] }
    // leg R
  ];
  var ARM_ENDPOINTS = {
    idle: { l: [40, 134], r: [160, 134] },
    // ARM_*_ANCHOR + ARM_*_D — the canonical resting splay
    open: { l: [26, 124], r: [174, 124] }
    // anchor + (-30,+18) / (+30,+18)
  };
  function limbsFor(armsMode) {
    var ep = ARM_ENDPOINTS[armsMode] || ARM_ENDPOINTS.idle;
    return [
      { a: [56, 106], e: ep.l },
      { a: [144, 106], e: ep.r },
      { a: [84, 145], e: [76, 177] },
      { a: [116, 145], e: [124, 177] }
    ];
  }
  function limbPath(a, e) {
    var mx = (a[0] + e[0]) / 2 + (e[0] - 100) * 0.16;
    var my = (a[1] + e[1]) / 2;
    return "M" + a[0] + "," + a[1] + " Q" + mx.toFixed(1) + "," + my.toFixed(1) + " " + e[0] + "," + e[1];
  }
  function rg(id, cx, cy, r, stops, units) {
    var s = stops.map(function(st) {
      return '<stop offset="' + st[0] + '" stop-color="' + st[1] + '"' + (st[2] != null ? ' stop-opacity="' + st[2] + '"' : "") + "/>";
    }).join("");
    return '<radialGradient id="' + id + '" gradientUnits="' + (units || "userSpaceOnUse") + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fx="' + cx + '" fy="' + cy + '">' + s + "</radialGradient>";
  }
  function svg(uid, armsMode) {
    var limbs = limbsFor(armsMode);
    var g = "e" + uid;
    var limbMarkup = limbs.map(function(l) {
      var d = limbPath(l.a, l.e);
      var nx = l.e[0], ny = l.e[1];
      return (
        // soft cyan glow under the wire (Blur 1.6, stroke 4.4, opacity .7)
        '<g opacity="0.7" filter="url(#' + g + 'fb)"><path d="' + d + '" fill="none" stroke="rgba(180,240,240,1)" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/></g><path d="' + d + '" fill="none" stroke="rgba(184,238,238,1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><g opacity="0.7" filter="url(#' + g + 'nb)"><circle cx="' + nx + '" cy="' + ny + '" r="6" fill="' + CYAN + '"/></g><circle cx="' + nx + '" cy="' + ny + '" r="4" fill="url(#' + g + 'nub)"/>'
      );
    }).join("");
    var mouth = '<path id="' + g + 'mouth" d="M92.5,112.75 Q100,116.37 107.5,112.35" fill="none" stroke="#332C24" stroke-width="1.7" stroke-linecap="round"/>';
    var eyes = '<ellipse id="' + g + 'eyeL" cx="82.4" cy="98" rx="3.8" ry="3.8" fill="#20201E"/><ellipse id="' + g + 'eyeR" cx="117.6" cy="98" rx="3.8" ry="3.8" fill="#20201E"/><ellipse id="' + g + 'shL" cx="81.11" cy="96.48" rx="1.6" ry="1.6" fill="#FFFFFF" opacity="0.9"/><ellipse id="' + g + 'shR" cx="116.31" cy="96.48" rx="1.6" ry="1.6" fill="#FFFFFF" opacity="0.9"/>';
    var brows = '<g id="' + g + 'brows" opacity="0.72"><path d="M78.65,81.25 Q82.4,80 86.15,81.25" fill="none" stroke="#382B25" stroke-width="2.3" stroke-linecap="round"/><path d="M113.85,81.25 Q117.6,80 121.35,81.25" fill="none" stroke="#382B25" stroke-width="2.3" stroke-linecap="round"/></g>';
    var glasses = GLASSES_URI && GLASSES_URI.charAt(0) === "d" ? '<image href="' + GLASSES_URI + '" xlink:href="' + GLASSES_URI + '" x="' + GLASSES_X + '" y="' + GLASSES_Y + '" width="' + GLASSES_W + '" height="' + GLASSES_H + '" preserveAspectRatio="none"/>' : "";
    return '<svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="overflow:visible"><defs><clipPath id="' + g + 'clip"><circle cx="100" cy="100" r="50"/></clipPath><filter id="' + g + 'hb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter><filter id="' + g + 'fb" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="' + g + 'nb" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="1.8"/></filter>' + // halo gradients
    rg(g + "haloA", 100, 100, 84, [["0.4", "rgba(158,229,229,0.55)"], ["1", "rgba(158,229,229,0)"]]) + rg(g + "haloB", 100, 100, 59, [["0.65", "rgba(158,229,229,0)"], ["0.92", "rgba(158,229,229,0.7)"], ["1", "rgba(158,229,229,0)"]]) + // 3a frosted cyan shell — focal above centre (100, 86), r 51
    rg(g + "shell", 100, 86, 51, [["0", "rgba(210,249,249,1)"], ["0.42", "rgba(150,232,233,1)"], ["0.74", "rgba(108,208,213,1)"], ["1", "rgba(84,186,197,1)"]]) + // 3b restrained coral core — focal below centre (100, 105), r 40.4, coreAlpha 0.84
    rg(g + "core", 100, 105, 40.4, [["0", "rgba(255,242,210,0.84)"], ["0.28", "rgba(255,186,118,0.77)"], ["0.55", "rgba(250,140,86,0.5)"], ["0.8", "rgba(242,124,74,0.22)"], ["1", "rgba(236,116,68,0)"]]) + // 3c bottom-edge teal depth — focal low (100, 131), r 45
    rg(g + "teal", 100, 131, 45, [["0", "rgba(34,120,134,0.4)"], ["0.7", "rgba(34,120,134,0)"], ["1", "rgba(34,120,134,0)"]]) + // 3d top-left specular
    rg(g + "spec", 85, 80, 21, [["0", "rgba(255,255,255,0.95)"], ["1", "rgba(255,255,255,0)"]]) + // 3f bright cyan rim — r 53
    rg(g + "rim", 100, 100, 53, [["0", "rgba(158,232,236,0)"], ["0.84", "rgba(186,244,247,0.30)"], ["0.95", "rgba(150,240,246,0.92)"], ["1", "rgba(120,224,236,0.55)"]]) + // nub gradient (objectBoundingBox so one def serves all 4 nubs)
    '<radialGradient id="' + g + 'nub" cx="35%" cy="35%" r="65%"><stop offset="0" stop-color="rgba(255,255,255,0.95)"/><stop offset="0.4" stop-color="#B8EEEE"/><stop offset="1" stop-color="' + CYAN_DEEP + '"/></radialGradient></defs><g id="' + g + 'root"><g id="' + g + 'halo" opacity="0.25" filter="url(#' + g + 'hb)"><circle cx="100" cy="100" r="84" fill="url(#' + g + 'haloA)"/><circle cx="100" cy="100" r="59" fill="url(#' + g + 'haloB)"/></g>' + // LAYER 2 — limbs behind the orb
    limbMarkup + // LAYER 3 — orb body
    '<circle cx="100" cy="100" r="50" fill="url(#' + g + 'shell)"/><g clip-path="url(#' + g + 'clip)"><circle cx="100" cy="100" r="50" fill="url(#' + g + 'core)"/><circle cx="100" cy="100" r="50" fill="url(#' + g + 'teal)"/></g><circle cx="85" cy="80" r="21" fill="url(#' + g + 'spec)" opacity="0.5"/><circle cx="118" cy="84" r="0.8" fill="rgba(255,255,255,0.9)"/><circle cx="78" cy="112" r="0.7" fill="rgba(255,255,255,0.8)"/><circle cx="108" cy="118" r="0.6" fill="rgba(255,255,255,0.75)"/><circle cx="100" cy="100" r="53" fill="url(#' + g + 'rim)"/>' + // LAYER 4 — face: mouth (resting smile), eyes + shine, brows, then glasses over them
    mouth + eyes + brows + glasses + "</g></svg>";
  }
  var reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var insts = [];
  var rafOn = false;
  function num(v) {
    return Math.round(v * 100) / 100;
  }
  function register(el, g) {
    var q = function(id) {
      return el.querySelector("#" + g + id);
    };
    var eyeL = q("eyeL"), eyeR = q("eyeR");
    if (!eyeL || !eyeR) return;
    var inst = {
      root: q("root"),
      halo: q("halo"),
      mouth: q("mouth"),
      brows: q("brows"),
      eyeL,
      eyeR,
      shL: q("shL"),
      shR: q("shR"),
      baseGY: 0,
      gx: 0,
      gy: 0,
      tgx: 0,
      tgy: 0,
      nextGlance: 1 + Math.random() * 2,
      blinking: false,
      blinkT: 0,
      blinkDur: 0.12,
      nextBlink: 2 + Math.random() * 3,
      wantSecond: false,
      tiltActive: -1,
      tiltT: 0,
      tiltTarget: 0,
      nextTilt: 6 + Math.random() * 6,
      aha: -1,
      t: Math.random() * 6
    };
    var gaze = el.getAttribute("data-gaze");
    if (gaze === "down") inst.baseGY = 3;
    else if (gaze === "up") inst.baseGY = -3;
    el.__echoReact = function() {
      if (!reducedMotion) inst.aha = 0;
    };
    insts.push(inst);
  }
  function update(inst, dt) {
    inst.t += dt;
    if (inst.blinking) {
      inst.blinkT += dt;
      if (inst.blinkT >= inst.blinkDur) {
        inst.blinking = false;
        inst.blinkT = 0;
        if (inst.wantSecond) {
          inst.wantSecond = false;
          inst.nextBlink = 0.14;
        } else {
          inst.wantSecond = Math.random() < 0.22;
          inst.nextBlink = 3 + Math.random() * 3;
        }
      }
    } else {
      inst.nextBlink -= dt;
      if (inst.nextBlink <= 0) {
        inst.blinking = true;
        inst.blinkT = 0;
      }
    }
    var blink = 0;
    if (inst.blinking) {
      var bp = inst.blinkT / inst.blinkDur;
      blink = bp < 0.5 ? bp * 2 : 2 - bp * 2;
    }
    inst.nextGlance -= dt;
    if (inst.nextGlance <= 0) {
      if (Math.random() < 0.4) {
        inst.tgx = 0;
        inst.tgy = 0;
      } else {
        inst.tgx = (Math.random() * 2 - 1) * 3.2;
        inst.tgy = (Math.random() * 2 - 1) * 1.8;
      }
      inst.nextGlance = 2.2 + Math.random() * 3;
    }
    var k = Math.min(1, dt * 4);
    inst.gx += (inst.tgx - inst.gx) * k;
    inst.gy += (inst.tgy - inst.gy) * k;
    var tilt = 0;
    if (inst.tiltActive >= 0) {
      inst.tiltActive += dt;
      var tp = inst.tiltActive / 1.6;
      if (tp >= 1) inst.tiltActive = -1;
      else tilt = inst.tiltTarget * Math.sin(tp * Math.PI);
    } else {
      inst.nextTilt -= dt;
      if (inst.nextTilt <= 0) {
        inst.tiltActive = 0;
        inst.tiltTarget = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 2);
        inst.nextTilt = 9 + Math.random() * 6;
      }
    }
    var aha = 0, nodY = 0;
    if (inst.aha >= 0) {
      inst.aha += dt;
      var ap = inst.aha / 0.72;
      if (ap >= 1) inst.aha = -1;
      else {
        aha = Math.sin(Math.min(1, ap * 1.35) * Math.PI);
        nodY = -5 * Math.sin(ap * Math.PI);
      }
    }
    var glow = 0.22 + 0.055 * (0.5 + 0.5 * Math.sin(inst.t * 1.3)) + aha * 0.16;
    var gx = inst.gx + 0, gy = inst.gy + inst.baseGY;
    var ry = 3.8 * Math.max(0.08, 1 - blink * 0.94) * (1 + aha * 0.28);
    var rx = 3.8 * (1 + aha * 0.12);
    var eyeCy = 98 + gy - aha * 0.8, shCy = 96.48 + gy - aha * 0.8;
    inst.eyeL.setAttribute("cx", num(82.4 + gx));
    inst.eyeL.setAttribute("cy", num(eyeCy));
    inst.eyeL.setAttribute("rx", num(rx));
    inst.eyeL.setAttribute("ry", num(ry));
    inst.eyeR.setAttribute("cx", num(117.6 + gx));
    inst.eyeR.setAttribute("cy", num(eyeCy));
    inst.eyeR.setAttribute("rx", num(rx));
    inst.eyeR.setAttribute("ry", num(ry));
    if (inst.shL && inst.shR) {
      var sh = Math.max(0, 1 - blink * 1.6) * 0.9;
      inst.shL.setAttribute("cx", num(81.11 + gx));
      inst.shL.setAttribute("cy", num(shCy));
      inst.shL.setAttribute("opacity", num(sh));
      inst.shR.setAttribute("cx", num(116.31 + gx));
      inst.shR.setAttribute("cy", num(shCy));
      inst.shR.setAttribute("opacity", num(sh));
    }
    if (inst.halo) inst.halo.setAttribute("opacity", num(glow));
    if (inst.brows) {
      inst.brows.setAttribute("transform", "translate(0," + num(-aha * 2.2) + ")");
      inst.brows.setAttribute("opacity", num(0.72 + aha * 0.2));
    }
    if (inst.mouth) {
      if (aha > 0.03) {
        inst.mouth.setAttribute("d", "M92,112.4 Q100," + num(116.37 + aha * 3.2) + " 108,112.0");
      } else {
        inst.mouth.setAttribute("d", "M92.5,112.75 Q100,116.37 107.5,112.35");
      }
    }
    if (inst.root) inst.root.setAttribute("transform", "translate(0," + num(nodY) + ") rotate(" + num(tilt) + " 100 100)");
  }
  var lastTs = null;
  function frame(ts) {
    if (lastTs === null) lastTs = ts;
    var dt = Math.min(0.05, (ts - lastTs) / 1e3);
    lastTs = ts;
    for (var i = 0; i < insts.length; i++) {
      try {
        update(insts[i], dt);
      } catch (e) {
      }
    }
    requestAnimationFrame(frame);
  }
  var seq = 0;
  function build(el) {
    if ((el.getAttribute("data-variant") || "idle") === "perched") {
      console.warn('[echo.js] data-variant="perched" is retired; use <canvas data-echo-perched> + harness/echo-perched.js. Rendering idle.');
    }
    var uid = ++seq;
    el.innerHTML = svg(uid, el.getAttribute("data-arms") || "idle");
    el.style.display = el.style.display || "inline-block";
    el.style.lineHeight = "0";
    return "e" + uid;
  }
  function run() {
    document.querySelectorAll(".echo").forEach(function(el) {
      var g = build(el);
      if (!reducedMotion) register(el, g);
    });
    if (!reducedMotion && insts.length && !rafOn) {
      rafOn = true;
      requestAnimationFrame(frame);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
